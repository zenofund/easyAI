import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { ChatRole, Prisma } from '@prisma/client';
import { searchWeb } from '../lib/search';

interface ChatRequest {
  message: string;
  session_id: string;
  // Optional filters
  filters?: {
    document_type?: string;
    year?: number;
  },
  web_search?: boolean;
}

interface DocumentChunk {
  chunk_id: string;
  document_id: string;
  document_title: string;
  document_type: string;
  document_citation: string | null;
  chunk_content: string;
  similarity: number;
  metadata: any;
}

// Generate embeddings using OpenAI API
async function generateEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-large',
      input: text,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Embedding generation failed:', error);
    throw new Error('Failed to generate embedding');
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Build context from retrieved documents
function buildRAGContext(chunks: DocumentChunk[]): string {
  if (chunks.length === 0) {
    return '';
  }

  let context = '\n\n## Relevant Legal Documents\n\n';

  chunks.forEach((chunk, index) => {
    context += `### Source ${index + 1}: ${chunk.document_title}\n`;
    if (chunk.document_citation) {
      context += `**Citation:** ${chunk.document_citation}\n`;
    }
    context += `**Type:** ${chunk.document_type}\n`;
    context += `**Relevance:** ${(chunk.similarity * 100).toFixed(1)}%\n\n`;
    context += `${chunk.chunk_content}\n\n`;
    context += '---\n\n';
  });

  return context;
}

// Format sources for response
function formatSources(chunks: DocumentChunk[]): any[] {
  return chunks.map(chunk => ({
    id: chunk.document_id,
    title: chunk.document_title.replace(/\.[^/.]+$/, ""),
    type: chunk.document_type,
    citation: chunk.document_citation,
    relevance: chunk.similarity,
    relevance_score: chunk.similarity,
    excerpt: chunk.chunk_content,
    metadata: chunk.metadata,
  }));
}

// Map configured model names to actual OpenAI API model names
function getOpenAIModel(configuredModel: string): string {
  const modelMap: Record<string, string> = {
    // Aliases for user-friendly names or future-proofing
    'gpt-5.2': 'o1-preview', // Map requested "5.2" to the advanced reasoning model
    'gpt-5': 'gpt-4o',
    'gpt-5-mini': 'gpt-4o-mini',
    'gpt-5-nano': 'gpt-4o-mini',
    
    // Official OpenAI Models
    'o1-preview': 'o1-preview',
    'o1-mini': 'o1-mini',
    'gpt-4o': 'gpt-4o',
    'gpt-4o-mini': 'gpt-4o-mini',
    'gpt-4-turbo': 'gpt-4-turbo-preview',
    'gpt-4': 'gpt-4',
    'gpt-3.5-turbo': 'gpt-3.5-turbo'
  };

  return modelMap[configuredModel] || 'gpt-4o-mini';
}

async function processAIResponse(
  res: Response,
  user_id: string,
  session_id: string,
  message: string,
  openaiApiKey: string,
  excludeMessageId?: string,
  filters?: { document_type?: string; year?: number },
  web_search?: boolean
) {
  const profile = await prisma.user.findUnique({
      where: { id: user_id },
      include: {
        subscriptions: {
          where: { status: 'active' },
          include: {
            plan: true
          }
        }
      }
    });

    if (!profile) {
      return res.status(403).json({ error: "Failed to load user profile" });
    }

    const subscription = profile.subscriptions?.[0];
    const plan = subscription?.plan;
    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin';

    if (!isAdmin && plan && plan.max_chats_per_day !== -1) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const usage = await prisma.usageTracking.findUnique({
        where: {
          user_id_feature_date: {
            user_id: user_id,
            feature: 'chat_message',
            date: today
          }
        }
      });

      if (usage && usage.count >= plan.max_chats_per_day) {
        return res.status(429).json({
          error: "CHAT_LIMIT_REACHED",
          current_usage: usage.count,
          max_limit: plan.max_chats_per_day,
          remaining: 0,
          plan_tier: plan.tier,
          upgrade_needed: true
        });
      }
    }

    // Generate embedding for the user's query
    let queryEmbedding: number[] | null = null;
    let retrievedChunks: DocumentChunk[] = [];
    let webSearchResults: any[] = [];
    let usedWebSearch = false;

    // Check if web search is requested and allowed
    if (web_search && plan?.internet_search) {
      try {
        console.log('Performing web search for:', message);
        webSearchResults = await searchWeb(message);
        usedWebSearch = true;
        
        // Convert web results to DocumentChunk format for consistent handling
        retrievedChunks = webSearchResults.map((result, index) => ({
          chunk_id: `web-${index}`,
          document_id: `web-doc-${index}`,
          document_title: result.title,
          document_type: 'web_page',
          document_citation: result.url,
          chunk_content: result.content,
          similarity: result.score || 0.8, // Default high score for web results
          metadata: { url: result.url, source: 'web_search' }
        }));
      } catch (searchError) {
        console.error('Web search failed:', searchError);
        // Fallback to standard RAG if web search fails
        usedWebSearch = false;
      }
    }
    
    // If web search was not used or returned no results, try standard RAG
    if (!usedWebSearch || retrievedChunks.length === 0) {
      try {
        queryEmbedding = await generateEmbedding(message, openaiApiKey);

        // Perform semantic search on document chunks using pgvector via Prisma raw query
        // Dynamically build where clause for filters
        const typeFilter = filters?.document_type ? Prisma.sql`AND d.type::text = ${filters.document_type}` : Prisma.empty;
        const yearFilter = filters?.year ? Prisma.sql`AND d.year = ${filters.year}` : Prisma.empty;

        const chunks = await prisma.$queryRaw<any[]>`
          SELECT
            dc.id AS chunk_id,
            d.id AS document_id,
            d.title AS document_title,
            d.type AS document_type,
            d.citation AS document_citation,
            dc.content AS chunk_content,
            1 - (dc.embedding <=> ${queryEmbedding}::vector) AS similarity,
            dc.metadata
          FROM "document_chunks" dc
          INNER JOIN "documents" d ON dc.document_id = d.id
          WHERE
            1 - (dc.embedding <=> ${queryEmbedding}::vector) > 0.45
            AND (d.is_public = true OR d.uploaded_by = ${user_id}::uuid)
            AND d.status = 'ready'
            ${typeFilter}
            ${yearFilter}
          ORDER BY dc.embedding <=> ${queryEmbedding}::vector
          LIMIT 10;
        `;

        if (chunks && chunks.length > 0) {
          retrievedChunks = chunks.map(chunk => ({
            chunk_id: chunk.chunk_id,
            document_id: chunk.document_id,
            document_title: chunk.document_title,
            document_type: chunk.document_type,
            document_citation: chunk.document_citation,
            chunk_content: chunk.chunk_content,
            similarity: (typeof chunk.similarity === 'number' ? chunk.similarity : parseFloat(chunk.similarity)) || 0,
            metadata: chunk.metadata
          }));
          console.log(`Found ${chunks.length} relevant document chunks`);
        }
      } catch (embeddingError) {
        console.error('RAG retrieval failed:', embeddingError);
        // Continue without RAG context
      }
    }

    // Fetch chat history
    const whereCondition: any = { 
        session_id: session_id
    };
    
    if (excludeMessageId) {
        whereCondition.id = { not: excludeMessageId };
    }

    const chatHistory = await prisma.chat.findMany({
      where: whereCondition,
      orderBy: { created_at: 'asc' },
      take: 10, // Limit context window
      select: { message: true, role: true }
    });


    // Build enhanced context with retrieved documents
    const ragContext = buildRAGContext(retrievedChunks);
    const contextType = usedWebSearch ? 'Web Search Results' : 'Legal Documents';
    const contextIntro = usedWebSearch 
      ? '**IMPORTANT:** You are answering based on the following **WEB SEARCH RESULTS**. Use them to provide up-to-date information. Cite the URLs provided.'
      : '**IMPORTANT:** You have access to relevant legal documents below. Use them to provide accurate, cited answers. Always reference the specific documents when using their information.';

    const systemPrompt = `You are easyAI, an expert legal research assistant specializing in Nigerian law. Your goal is to provide accurate, professional, and well-structured legal information while maintaining a friendly and helpful demeanor.

**PERSONA & TONE:**
- Be professional yet warm and approachable.
- Avoid robotic disclaimers like "As an AI model" or "I am an AI assistant".
- If a user asks a personal question (e.g., "How are you?", "What is your name?"), answer naturally and briefly, then gently pivot back to how you can help with legal matters.
- Use natural language. Instead of "I am designed to...", say "I'm here to..." or "My focus is...".

**FORMATTING & RICH CONTENT INSTRUCTIONS:**
- **Structure your response using clear paragraphs.** Avoid long blocks of text.
- **Use markdown headings (###)** to organize different sections of your answer.
- **Use bullet points or numbered lists** when presenting multiple items, steps, or cases.
- **Use bold text** to highlight key legal terms or important principles.
- **Use markdown tables** for comparisons (e.g., comparing two statutes, case outcomes, or pros/cons of a legal strategy).
- **Draft clauses or documents** when relevant to the user's query (e.g., "Here is a draft clause for your contract...").
- **Identify potential risks and opportunities** in your analysis to provide strategic value.
- **Use markdown formatting** for better readability.

Always cite relevant laws, cases, and legal principles when applicable.

**HANDLING NON-LEGAL QUESTIONS (The 3-Step Pivot):**
1. **Acknowledge & Validate:** Briefly acknowledge the user's question or comment in a friendly way.
2. **Soft Role Reminder:** Gently remind the user of your expertise in Nigerian law without being robotic.
3. **Pivot to Law:** Ask if there is a legal angle to their query or if they have a legal question you can assist with.

*Example:*
User: "Who won the football match yesterday?"
Response: "I'm not sure who won, as I don't track sports results! I'm fully dedicated to Nigerian legal research. Was there a legal dispute about the match, or can I help you with a case or statute today?"

**EXCEPTION:** If you are provided with document context/sources below, you MUST answer questions related to those documents, even if the question itself seems general (e.g., "Summarize this", "What is this document about?", "Who are the parties?").

${ragContext ? `${contextIntro}\n\n${ragContext}` : ''}`;

    const messages = [
      {
        role: "system",
        content: systemPrompt
      },
      ...(chatHistory || []).map((msg: any) => ({
        role: msg.role,
        content: msg.message
      })),
      // If the last message in history is not the user message we are processing, append it.
      // But chatHistory might already include it if we didn't exclude it?
      // Wait, in handleChat we excluded it.
      // Here, we should append the current message if it's not in history.
      // Since we are processing a "new" response for "message", and "message" corresponds to a user message that IS in DB (usually),
      // but we excluded it in fetch?
      // In handleChat, we excluded userMessage.id.
      // So here we should append it.
      {
        role: "user",
        content: message
      }
    ];

    const configuredModel = (plan?.features as any)?.ai_model || 'gpt-4o-mini';
    const modelToUse = getOpenAIModel(configuredModel);

    console.log(`Using model: ${modelToUse} (configured: ${configuredModel}) for user ${user_id}`);

    let openaiResponse;
    let actualModelUsed = modelToUse;

    try {
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: messages,
          max_completion_tokens: 2000,
        }),
      });

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error(`OpenAI API error (${openaiResponse.status}):`, errorText);

        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: { message: errorText } };
        }

        if (openaiResponse.status === 404 && errorData.error?.message?.includes('model')) {
          console.log(`Model ${modelToUse} not found, falling back to gpt-4o-mini`);
          actualModelUsed = 'gpt-4o-mini';

          openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: messages,
              max_completion_tokens: 2000,
            }),
          });

          if (!openaiResponse.ok) {
            const fallbackErrorText = await openaiResponse.text();
            console.error('Fallback model also failed:', fallbackErrorText);
            throw new Error(`Fallback model failed: ${fallbackErrorText}`);
          }
        } else if (openaiResponse.status === 429) {
          return res.status(429).json({
            error: "AI_RATE_LIMIT:The AI service is currently experiencing high demand. Please try again in a moment."
          });
        } else if (openaiResponse.status === 401) {
          return res.status(500).json({
            error: "AI_SERVER_ERROR:API authentication failed. Please contact support."
          });
        } else {
          return res.status(500).json({
            error: `AI_SERVER_ERROR:Failed to get response from AI service. Please try again. (Status: ${openaiResponse.status})`
          });
        }
      }
    } catch (fetchError) {
      console.error('Network error calling OpenAI:', fetchError);
      return res.status(500).json({
        error: "AI_SERVER_ERROR:Network error connecting to AI service. Please check your connection and try again."
      });
    }

    const aiData = await openaiResponse.json();
    const aiMessage = aiData.choices?.[0]?.message?.content;
    const tokensUsed = aiData.usage?.total_tokens || 0;

    if (!aiMessage) {
      console.error('No message in AI response:', aiData);
      return res.status(500).json({
        error: "AI_SERVER_ERROR:Invalid response from AI service. Please try again."
      });
    }

    if (!isAdmin) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.usageTracking.upsert({
        where: {
          user_id_feature_date: {
            user_id: user_id,
            feature: 'chat_message',
            date: today
          }
        },
        update: {
          count: { increment: 1 }
        },
        create: {
          user_id: user_id,
          feature: 'chat_message',
          date: today,
          count: 1
        }
      });
    }

    // Format sources from retrieved chunks
    const sources = formatSources(retrievedChunks);

    // Save assistant message with sources
    const insertedMessage = await prisma.chat.create({
      data: {
        user_id: user_id,
        session_id: session_id,
        message: aiMessage,
        role: ChatRole.assistant,
        sources: sources,
        tokens_used: tokensUsed,
        model_used: actualModelUsed,
        metadata: {
          rag_enabled: retrievedChunks.length > 0,
          chunks_retrieved: retrievedChunks.length,
        }
      }
    });

    // Update session message count for assistant message
    await prisma.chatSession.update({
      where: { id: session_id },
      data: {
        message_count: { increment: 1 },
        last_message_at: new Date()
      }
    });

    return res.status(200).json(insertedMessage);
}

export const handleChat = async (req: Request, res: Response) => {
  try {
    const { message, session_id, filters, web_search }: ChatRequest = req.body;
    const user_id = req.user?.id;

    if (!message || !session_id) {
      return res.status(400).json({
        error: "Missing required fields: message and session_id are required"
      });
    }

    if (!user_id) {
       return res.status(401).json({ error: "User not authenticated" });
    }

    // Use environment variables from process.env
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return res.status(500).json({
        error: "AI_SERVER_ERROR:OpenAI API key not configured. Please contact support."
      });
    }

    // Save user message first
    const userMessage = await prisma.chat.create({
      data: {
        user_id,
        session_id,
        message,
        role: ChatRole.user,
        tokens_used: 0,
        model_used: null,
      }
    });

    // Update session last_message_at
    await prisma.chatSession.update({
      where: { id: session_id },
      data: {
        last_message_at: new Date(),
        // Increment message count for user message
        message_count: { increment: 1 }
      }
    }).catch(async (err) => {
      // If session doesn't exist (first message), create it
      // Although frontend usually creates session first, let's be safe
      if (err.code === 'P2025') {
         await prisma.chatSession.create({
           data: {
             id: session_id,
             user_id,
             title: message.substring(0, 50) + '...',
             last_message_at: new Date(),
             message_count: 1
           }
         });
      }
    });

    // Call shared logic
    return processAIResponse(
      res,
      user_id,
      session_id,
      message,
      openaiApiKey,
      undefined,
      filters,
      web_search
    );

  } catch (error: any) {
    console.error("Chat error:", error);

    return res.status(500).json({
      error: "An unexpected error occurred",
      details: error.message
    });
  }
};

export const regenerateChat = async (req: Request, res: Response) => {
  try {
    const { message_id, session_id } = req.body;
    const user_id = req.user?.id;

    if (!message_id || !session_id) {
       return res.status(400).json({ error: "Missing message_id or session_id" });
    }
    if (!user_id) {
       return res.status(401).json({ error: "User not authenticated" });
    }

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return res.status(500).json({
        error: "AI_SERVER_ERROR:OpenAI API key not configured."
      });
    }

    // 1. Find the message to regenerate
    const messageToRegenerate = await prisma.chat.findUnique({
      where: { id: message_id }
    });

    if (!messageToRegenerate) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (messageToRegenerate.user_id !== user_id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (messageToRegenerate.role !== 'assistant') {
      return res.status(400).json({ error: "Can only regenerate assistant messages" });
    }

    // 2. Find the preceding user message
    const lastUserMessage = await prisma.chat.findFirst({
      where: {
        session_id,
        created_at: { lt: messageToRegenerate.created_at },
        role: 'user'
      },
      orderBy: { created_at: 'desc' }
    });

    if (!lastUserMessage) {
      return res.status(400).json({ error: "No preceding user message found" });
    }

    // 3. Delete the assistant message
    await prisma.chat.delete({
      where: { id: message_id }
    });
    
    // 4. Reuse logic to generate response
    await processAIResponse(res, user_id, session_id, lastUserMessage.message, openaiApiKey, lastUserMessage.id);

  } catch (error: any) {
    console.error("Regenerate chat error:", error);
    res.status(500).json({ error: "Failed to regenerate chat", details: error.message });
  }
};

export const submitFeedback = async (req: Request, res: Response) => {
  try {
    const { message_id, feedback_type } = req.body;
    const user_id = (req as any).user?.id;

    if (!message_id || !feedback_type) {
      return res.status(400).json({ error: "Missing message_id or feedback_type" });
    }
    if (!user_id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!['positive', 'negative'].includes(feedback_type)) {
      return res.status(400).json({ error: "Invalid feedback_type. Must be 'positive' or 'negative'" });
    }

    // Verify message exists
    const message = await prisma.chat.findUnique({
      where: { id: message_id }
    });

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Create or update feedback
    const feedback = await prisma.messageFeedback.upsert({
      where: {
        user_id_message_id: {
          user_id,
          message_id
        }
      },
      update: {
        feedback_type
      },
      create: {
        user_id,
        message_id,
        feedback_type
      }
    });

    res.json(feedback);
  } catch (error: any) {
    console.error("Submit feedback error:", error);
    res.status(500).json({ error: "Failed to submit feedback", details: error.message });
  }
};
