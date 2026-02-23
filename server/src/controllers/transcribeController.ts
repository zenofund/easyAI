import { Request, Response } from 'express';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import prisma from '../lib/prisma';

export const transcribeAudio = async (req: Request, res: Response) => {
  let tempFilePath: string | null = null;
  try {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Rename file to have the correct extension for OpenAI
    const originalExt = path.extname(req.file.originalname);
    tempFilePath = `${req.file.path}${originalExt}`;
    fs.renameSync(req.file.path, tempFilePath);

    // Check subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        user_id: userId,
        status: 'active',
      },
      include: {
        plan: true,
      },
    });

    const tier = subscription?.plan?.tier || 'free';
    
    if (tier === 'free') {
      // Clean up file before returning error
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      return res.status(403).json({ error: 'Upgrade Required: Voice dictation is available only on Pro and Enterprise plans.' });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempFilePath),
      model: 'whisper-1',
    });

    // Clean up the file
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.json({ text: transcription.text });
  } catch (error: any) {
    console.error('Transcription error:', error);
    // Clean up file if it exists
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    } else if (req.file && fs.existsSync(req.file.path)) {
      // Fallback cleanup for original file if rename failed or wasn't done
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message || 'Transcription failed' });
  }
};
