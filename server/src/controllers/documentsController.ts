import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import * as fs from 'fs';
import * as path from 'path';
import pdf from 'pdf-parse-new';
import * as mammoth from 'mammoth';
import { createWorker } from 'tesseract.js';
import { DocumentType } from '@prisma/client';
import { trackUsage } from '../lib/usage';

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Generate embedding using OpenAI API
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

// Helper to extract text from file
async function extractText(filePath: string, mimeType: string): Promise<string> {
  const buffer = fs.readFileSync(filePath);

  if (mimeType === 'application/pdf') {
    let extractedText = "";
    try {
      const data = await pdf(buffer);
      extractedText = data.text;
      
      // If we got meaningful text, return it
      if (extractedText && extractedText.trim().length > 100) {
        return extractedText;
      }
      
      console.log('PDF text extraction yielded empty/low results.');
      
    } catch (e) {
      console.log('PDF text extraction failed.', e);
    }
    
    // Fallback message for scanned PDFs if we can't do OCR on them yet
    return "[SCANNED PDF - TEXT EXTRACTION FAILED. PLEASE ENSURE FILE IS READABLE OR UPLOAD IMAGES DIRECTLY]";
  } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } else if (mimeType === 'text/plain') {
    return buffer.toString('utf-8');
  } else if (mimeType.startsWith('image/')) {
     // Implement OCR for images
     console.log('Performing OCR on image...');
     const worker = await createWorker('eng');
     const ret = await worker.recognize(filePath);
     await worker.terminate();
     return ret.data.text;
  } else {
    throw new Error('Unsupported file type');
  }
}

// Helper to chunk text with overlap
function chunkText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  // Normalize newlines
  const normalizedText = text.replace(/\r\n/g, '\n');
  
  if (normalizedText.length <= chunkSize) {
    return [normalizedText];
  }

  let startIndex = 0;
  
  while (startIndex < normalizedText.length) {
    let endIndex = startIndex + chunkSize;
    
    // If we're near the end, just take the rest
    if (endIndex >= normalizedText.length) {
      chunks.push(normalizedText.slice(startIndex).trim());
      break;
    }
    
    // Look for a natural break point to end the chunk
    // Priorities: Paragraph break -> Sentence end -> Space -> Hard cut
    let breakPoint = -1;
    
    // Check for paragraph break within the last 20% of the chunk window
    const lookbackWindow = Math.floor(chunkSize * 0.2);
    const searchStart = Math.max(startIndex, endIndex - lookbackWindow);
    
    const lastParagraphBreak = normalizedText.lastIndexOf('\n\n', endIndex);
    if (lastParagraphBreak > searchStart) {
        breakPoint = lastParagraphBreak;
    }
    
    // Check for sentence end (.!?)
    if (breakPoint === -1) {
        const lastPeriod = normalizedText.lastIndexOf('. ', endIndex);
        const lastExclaim = normalizedText.lastIndexOf('! ', endIndex);
        const lastQuestion = normalizedText.lastIndexOf('? ', endIndex);
        
        const lastSentenceBreak = Math.max(lastPeriod, lastExclaim, lastQuestion);
        
        if (lastSentenceBreak > searchStart) {
            breakPoint = lastSentenceBreak + 1; // Include the punctuation
        }
    }
    
    // Check for space
    if (breakPoint === -1) {
        const lastSpace = normalizedText.lastIndexOf(' ', endIndex);
        if (lastSpace > searchStart) {
            breakPoint = lastSpace;
        }
    }
    
    // Fallback: hard cut
    if (breakPoint === -1) {
        breakPoint = endIndex;
    }
    
    // Add the chunk
    const chunk = normalizedText.slice(startIndex, breakPoint).trim();
    if (chunk) {
        chunks.push(chunk);
    }
    
    // Calculate next start index with overlap
    // We want to start 'overlap' characters before the breakPoint
    // But we should align to a word boundary if possible
    
    let nextStart = breakPoint - overlap;
    
    // Ensure we advance at least by 1 character (or more reasonably, by 10% of chunkSize)
    // to avoid infinite loops if overlap is too large relative to progress
    const minProgress = Math.max(1, Math.floor(chunkSize * 0.1));
    if (nextStart <= startIndex) {
        nextStart = startIndex + minProgress;
    }
    
    // Align nextStart to nearest space/newline to the left
    if (nextStart < normalizedText.length && nextStart > 0) {
        const alignSpace = normalizedText.lastIndexOf(' ', nextStart);
        const alignNewline = normalizedText.lastIndexOf('\n', nextStart);
        const bestAlign = Math.max(alignSpace, alignNewline);
        
        if (bestAlign > startIndex && bestAlign < breakPoint) {
            nextStart = bestAlign + 1;
        }
    }
    
    startIndex = nextStart;
  }
  
  return chunks;
}

async function processDocument(documentId: string, filePath: string, mimeType: string, userId: string) {
    try {
        console.log(`Processing document ${documentId}...`);
        const content = await extractText(filePath, mimeType);
        
        await prisma.document.update({
            where: { id: documentId },
            data: { content, status: 'processing' }
        });
        
        const chunks = chunkText(content);
        const openaiApiKey = process.env.OPENAI_API_KEY;
        
        if (openaiApiKey) {
            for (let i = 0; i < chunks.length; i++) {
                const chunkContent = chunks[i];
                try {
                    const embedding = await generateEmbedding(chunkContent, openaiApiKey);
                    
                    await prisma.$executeRaw`
                        INSERT INTO "document_chunks" (id, document_id, content, embedding, chunk_index, metadata, created_at)
                        VALUES (gen_random_uuid(), ${documentId}::uuid, ${chunkContent}, ${embedding}::vector, ${i}, '{}', NOW())
                    `;
                } catch (error) {
                    console.error(`Error generating embedding for chunk ${i}:`, error);
                }
            }
        }
        
        await prisma.document.update({
            where: { id: documentId },
            data: { status: 'ready' }
        });
        console.log(`Document ${documentId} processed successfully.`);
        
    } catch (error) {
        console.error(`Error processing document ${documentId}:`, error);
        await prisma.document.update({
            where: { id: documentId },
            data: { status: 'error' }
        });
    }
}

export const getDocumentsCount = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const count = await prisma.document.count({
      where: { uploaded_by: user.id }
    });

    res.json({ count });
  } catch (error) {
    console.error('Error getting documents count:', error);
    res.status(500).json({ error: 'Failed to get documents count' });
  }
};

export const uploadDocument = async (req: Request, res: Response) => {
  try {
    const { user } = req as any;
    const file = req.file;
    const { type = 'case', title, jurisdiction, year, citation } = req.body;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Check document limits
    const profile = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        subscriptions: {
          where: { status: 'active' },
          include: { plan: true }
        }
      }
    });

    const maxDocs = profile?.subscriptions?.[0]?.plan?.max_documents || 10;
    const currentCount = await prisma.document.count({
      where: { uploaded_by: user.id }
    });

    if (currentCount >= maxDocs) {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      return res.status(403).json({ error: 'Document limit reached' });
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        title: title || file.originalname,
        file_url: file.path,
        type: type as DocumentType,
        jurisdiction,
        year: year ? parseInt(year) : undefined,
        citation,
        uploaded_by: user.id,
        is_public: false, // User uploads are private by default
        file_size: file.size,
        status: 'processing',
        metadata: {
          mime_type: file.mimetype,
          original_name: file.originalname
        }
      }
    });

    // Serialize document (handle BigInt)
    const serializedDocument = {
      ...document,
      file_size: document.file_size?.toString()
    };

    res.status(201).json({ success: true, document: serializedDocument });
    
    // Trigger async processing
    processDocument(document.id, file.path, file.mimetype, user.id);

  } catch (error) {
    console.error('Error uploading document:', error);
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('Error deleting file:', e);
      }
    }
    res.status(500).json({ error: 'Failed to upload document' });
  }
};

export const getDocuments = async (req: Request, res: Response) => {
  try {
    const { user } = req as any;
    const { type, limit = 50 } = req.query;

    const where: any = {
      uploaded_by: user.id
    };

    if (type) {
      where.type = type;
    }

    const documents = await prisma.document.findMany({
      where,
      orderBy: { created_at: 'desc' },
      take: Number(limit),
      select: {
        id: true,
        title: true,
        type: true,
        citation: true,
        created_at: true,
        file_size: true,
        status: true
      }
    });

    // Convert BigInt to string for JSON serialization
    const serializedDocuments = documents.map(doc => ({
      ...doc,
      file_size: doc.file_size?.toString()
    }));

    res.json(serializedDocuments);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
};

export const deleteDocument = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user } = req as any;

    const whereClause: any = {
      id: id as string
    };

    // Only restrict by uploaded_by if not an admin
    if (user.role !== 'admin' && user.role !== 'super_admin') {
      whereClause.uploaded_by = user.id;
    }

    const document = await prisma.document.findFirst({
      where: whereClause
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete file from filesystem if it exists
    if (document.file_url && fs.existsSync(document.file_url)) {
      try {
        fs.unlinkSync(document.file_url);
      } catch (e) {
        console.error('Error deleting file:', e);
      }
    }

    // Delete from database (chunks will be deleted via cascade)
    await prisma.document.delete({
      where: { id: id as string }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
};

export const updateDocument = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { user } = req as any;
      const { title, type, citation, jurisdiction, year } = req.body;
  
      const whereClause: any = {
        id: id as string
      };
  
      if (user.role !== 'admin' && user.role !== 'super_admin') {
        whereClause.uploaded_by = user.id;
      }
  
      const document = await prisma.document.findFirst({
        where: whereClause
      });
  
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
  
      const updatedDocument = await prisma.document.update({
        where: { id: id as string },
        data: {
          title,
          type: type as DocumentType,
          citation,
          jurisdiction,
          year: year ? parseInt(year) : undefined
        }
      });
  
      res.json({ success: true, document: {
        ...updatedDocument,
        file_size: updatedDocument.file_size?.toString()
      }});
    } catch (error) {
      console.error('Error updating document:', error);
      res.status(500).json({ error: 'Failed to update document' });
    }
};

export const getDocumentUsage = async (req: Request, res: Response) => {
    try {
        const { user } = req as any;
        
        const count = await prisma.document.count({
            where: { uploaded_by: user.id }
        });

        const profile = await prisma.user.findUnique({
            where: { id: user.id },
            include: {
                subscriptions: {
                    where: { status: 'active' },
                    include: { plan: true }
                }
            }
        });

        const max = profile?.subscriptions?.[0]?.plan?.max_documents || 10;

        res.json({
            current: count,
            max: max
        });
    } catch (error) {
        console.error('Error getting document usage:', error);
        res.status(500).json({ error: 'Failed to get document usage' });
    }
};

export const summarizeCase = async (req: Request, res: Response) => {
  try {
    const { user } = req as any;
    const { document_id } = req.body;

    if (!document_id) {
      return res.status(400).json({ error: 'Document ID is required' });
    }

    // Check if user has access to document
    const document = await prisma.document.findFirst({
      where: {
        id: document_id,
        OR: [
            { uploaded_by: user.id },
            { is_public: true }
        ]
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (!document.content) {
        return res.status(400).json({ error: 'Document content is empty' });
    }

    // Check if summary already exists in metadata
    // ... (implementation skipped for brevity)

    // Generate summary using OpenAI
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: 'You are a legal assistant. Summarize the following legal document concisely, highlighting key facts, issues, holding, and reasoning.' },
                { role: 'user', content: document.content.substring(0, 15000) } // Limit context window
            ]
        }),
    });

    if (!response.ok) {
        throw new Error('OpenAI API request failed');
    }

    const data = await response.json();
    const summary = data.choices[0].message.content;

    // Track usage
    await trackUsage(user.id, 'case_summarizer');

    res.json({ success: true, summary });

  } catch (error) {
    console.error('Error summarizing case:', error);
    res.status(500).json({ error: 'Failed to summarize case' });
  }
};

export const generateBrief = async (req: Request, res: Response) => {
  try {
    const { user } = req as any;
    const { 
      document_id, 
      case_text, 
      brief_type = 'trial',
      jurisdiction = 'nigeria',
      court,
      case_number,
      parties_plaintiff,
      parties_defendant,
      additional_instructions
    } = req.body;

    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
      return res.status(500).json({ error: 'OpenAI API key not configured' });
    }

    let textContext = case_text || '';

    if (document_id) {
        const document = await prisma.document.findFirst({
            where: {
              id: document_id,
              OR: [
                  { uploaded_by: user.id },
                  { is_public: true }
              ]
            }
          });

      if (document && document.content) {
        textContext = document.content;
      }
    }

    if (textContext.length > 50000) {
        textContext = textContext.substring(0, 50000);
    }

    const prompt = `
      Please generate a legal brief based on the following information:
      Brief Type: ${brief_type}
      Jurisdiction: ${jurisdiction}
      Court: ${court}
      Case Number: ${case_number || 'N/A'}
      Plaintiff: ${parties_plaintiff || 'N/A'}
      Defendant: ${parties_defendant || 'N/A'}
      Additional Instructions: ${additional_instructions || 'None'}

      Context/Case Material:
      ${textContext}

      Structure the output as a JSON object with the following fields:
      - title: string
      - brief_type: string
      - jurisdiction: string
      - court: string
      - case_number: string
      - parties_plaintiff: string
      - parties_defendant: string
      - introduction: string
      - statement_of_facts: string
      - issues_presented: string[]
      - legal_arguments: string
      - analysis: string
      - conclusion: string
      - prayer_for_relief: string
      - citations_used: string[]
    `;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o', // Use stronger model for drafting briefs
        messages: [
          { role: 'system', content: 'You are a legal assistant specializing in drafting legal briefs.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error('OpenAI API Error:', errText);
        throw new Error('OpenAI API request failed');
    }

    const data = await response.json();
    const brief = JSON.parse(data.choices[0].message.content);

    // Track usage
    await trackUsage(user.id, 'ai_drafting');

    res.json({ success: true, brief });

  } catch (error) {
    console.error('Error generating brief:', error);
    res.status(500).json({ error: 'Failed to generate brief' });
  }
};

export const getDocumentContent = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { user } = req as any;

    const document = await prisma.document.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        content: true,
        file_url: true,
        uploaded_by: true,
        is_public: true
      }
    });

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access permissions
    if (document.uploaded_by !== user.id && !document.is_public && user.role !== 'admin' && user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      id: document.id,
      title: document.title,
      content: document.content
    });

  } catch (error) {
    console.error('Error fetching document content:', error);
    res.status(500).json({ error: 'Failed to fetch document content' });
  }
};
