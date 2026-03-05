import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { ChatRole, Prisma } from '@prisma/client';

export const getTemplates = async (req: Request, res: Response) => {
  try {
    const { category } = req.query;
    
    const where: Prisma.LegalTemplateWhereInput = {
      is_active: true
    };
    
    if (category) {
      where.category = String(category);
    }

    const templates = await prisma.legalTemplate.findMany({
      where,
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        category: true,
        sub_category: true,
        description: true,
        structure: true
      }
    });

    res.json(templates);
  } catch (error: any) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
};

export const generateDraft = async (req: Request, res: Response) => {
  try {
    const { template_id, inputs, session_id } = req.body;
    const user_id = (req as any).user?.id;

    if (!template_id || !inputs || !session_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 1. Check user plan
    const profile = await prisma.user.findUnique({
      where: { id: user_id },
      include: {
        subscriptions: {
          where: { status: 'active' },
          include: { plan: true }
        }
      }
    });

    const plan = profile?.subscriptions?.[0]?.plan;
    if (!plan?.ai_drafting) { // Enterprise feature check
      return res.status(403).json({ 
        error: 'UPGRADE_REQUIRED',
        message: 'This feature requires an Enterprise plan.' 
      });
    }

    // 2. Fetch template
    const template = await prisma.legalTemplate.findUnique({
      where: { id: template_id }
    });

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    // 3. Construct prompt
    const inputSummary = Object.entries(inputs)
      .map(([key, value]) => `${key}: ${value}`)
      .join('\n');

    const prompt = `
You are an expert Nigerian Legal Draftsman.
Your task is to draft a "${template.title}" based on the following inputs.

TEMPLATE INSTRUCTIONS:
${template.system_prompt}

USER INPUTS:
${inputSummary}

DRAFTING RULES:
1. Use professional Nigerian legal terminology.
2. Format correctly with proper headings.
3. Include all necessary clauses standard for this document type in Nigeria.
4. Ensure compliance with relevant Nigerian laws (e.g., LFN 2004, Evidence Act 2011).
5. Output ONLY the document content in Markdown format.
`;

    // 4. Call AI (using the same openai instance/logic as chat)
    // We can reuse the openai logic from chatController or call OpenAI directly here
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
        throw new Error("OpenAI API key not configured");
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o', // Use a smart model for drafting
          messages: [{ role: 'system', content: prompt }],
          max_completion_tokens: 4000,
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const draftContent = data.choices[0].message.content;

    // 5. Save to chat history
    await prisma.chat.create({
      data: {
        user_id,
        session_id,
        role: ChatRole.assistant,
        message: `**DRAFT GENERATED: ${template.title}**\n\n${draftContent}`,
        metadata: {
            type: 'legal_draft',
            template_id,
            inputs
        }
      }
    });
    
    // Update usage
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await prisma.usageTracking.upsert({
        where: {
            user_id_feature_date: {
                user_id,
                feature: 'ai_drafting',
                date: today
            }
        },
        update: { count: { increment: 1 } },
        create: { user_id, feature: 'ai_drafting', date: today, count: 1 }
    });

    // Save to artifacts if premium user
    if (plan?.tier === 'pro' || plan?.tier === 'enterprise') {
        await prisma.userArtifact.create({
            data: {
                user_id,
                type: 'draft',
                title: template.title,
                content: draftContent,
                metadata: { template_id, inputs }
            }
        });
    }

    res.json({ draft: draftContent });

  } catch (error: any) {
    console.error('Draft generation error:', error);
    res.status(500).json({ error: 'Failed to generate draft' });
  }
};
