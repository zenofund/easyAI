import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import crypto from 'crypto';

export const createSession = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const session = await prisma.chatSession.create({
      data: {
        user_id,
        title: 'New Chat',
      }
    });

    res.json(session);
  } catch (error) {
    console.error('Create session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
};

export const getSessions = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.id;
    const { is_archived, limit, startDate, endDate } = req.query;

    if (!user_id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const whereClause: any = { user_id };
    if (is_archived !== undefined) {
      whereClause.is_archived = is_archived === 'true';
    }

    if (startDate || endDate) {
      whereClause.last_message_at = {};
      if (startDate) {
        whereClause.last_message_at.gte = new Date(startDate as string);
      }
      if (endDate) {
        whereClause.last_message_at.lte = new Date(endDate as string);
      }
    }

    const sessions = await prisma.chatSession.findMany({
      where: whereClause,
      orderBy: { last_message_at: 'desc' },
      take: limit ? parseInt(limit as string) : undefined,
      include: {
        chats: {
          orderBy: { created_at: 'asc' },
          take: 1,
          select: {
            message: true,
            role: true
          }
        }
      }
    });

    // Transform sessions to use first message as title if title is generic
    const transformedSessions = sessions.map(session => {
      let title = session.title;
      // Log for debugging
      // console.log(`Session ${session.id}: title="${title}", chats=${session.chats.length}`);
      
      if ((!title || title === 'New Chat' || title === 'New Conversation') && session.chats.length > 0) {
        // Find first user message if possible, otherwise first message
        const firstMessage = session.chats[0];
        title = firstMessage.message;
        
        // Truncate to reasonable length (e.g., 50 chars)
        if (title.length > 50) {
          title = title.substring(0, 50) + '...';
        }
      }
      return {
        ...session,
        title,
        first_message: session.chats.length > 0 ? session.chats[0].message : null
      };
    });

    res.json(transformedSessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
};

export const getSessionMessages = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify ownership
    const session = await prisma.chatSession.findUnique({
      where: { id: String(id) }
    });

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (session.user_id !== user_id) {
      return res.status(403).json({ error: 'Unauthorized access to session' });
    }

    const messages = await prisma.chat.findMany({
      where: { session_id: String(id) },
      orderBy: { created_at: 'asc' }
    });

    res.json(messages);
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
};

export const shareSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    // Verify ownership
    const session = await prisma.chatSession.findUnique({
      where: { id: String(id) }
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.user_id !== user_id) {
      return res.status(403).json({ error: "Unauthorized access to session" });
    }

    const shareToken = crypto.randomBytes(16).toString('hex');

    const shared = await prisma.sharedConversation.create({
      data: {
        user_id,
        session_id: String(id),
        share_token: shareToken,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      }
    });

    res.json(shared);

  } catch (error) {
    console.error("Share session error:", error);
    res.status(500).json({ error: "Failed to share session" });
  }
};

export const updateSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, is_archived } = req.body;
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: String(id) }
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.user_id !== user_id) {
      return res.status(403).json({ error: "Unauthorized access to session" });
    }

    const updatedSession = await prisma.chatSession.update({
      where: { id: String(id) },
      data: {
        title: title !== undefined ? title : undefined,
        is_archived: is_archived !== undefined ? is_archived : undefined,
      }
    });

    res.json(updatedSession);
  } catch (error) {
    console.error("Update session error:", error);
    res.status(500).json({ error: "Failed to update session" });
  }
};

export const deleteSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user_id = req.user?.id;

    if (!user_id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: String(id) }
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found" });
    }

    if (session.user_id !== user_id) {
      return res.status(403).json({ error: "Unauthorized access to session" });
    }

    await prisma.chatSession.delete({
      where: { id: String(id) }
    });

    res.json({ message: "Session deleted" });
  } catch (error) {
    console.error("Delete session error:", error);
    res.status(500).json({ error: "Failed to delete session" });
  }
};

export const getSharedSession = async (req: Request, res: Response) => {
  try {
    const { shareToken } = req.params;

    const shared = await prisma.sharedConversation.findUnique({
      where: { share_token: shareToken as string },
      include: {
        session: true,
        user: {
          select: {
            name: true
          }
        }
      }
    });

    if (!shared) {
      return res.status(404).json({ error: 'Shared session not found' });
    }

    if (!shared.is_active) {
       return res.status(410).json({ error: 'This shared link is no longer active' });
    }

    if (shared.expires_at && new Date() > shared.expires_at) {
      return res.status(410).json({ error: 'This shared link has expired' });
    }

    // Fetch messages manually since relation might not exist in Prisma schema
    const messages = await prisma.chat.findMany({
      where: { session_id: shared.session_id },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        role: true,
        message: true,
        created_at: true,
        sources: true,
        metadata: true
      }
    });

    // Return the session data
    const sharedData = shared as any;
    res.json({
      title: sharedData.session.title,
      created_at: sharedData.session.created_at,
      shared_by: sharedData.user.name,
      messages: messages
    });

  } catch (error) {
    console.error('Get shared session error:', error);
    res.status(500).json({ error: 'Failed to fetch shared session' });
  }
};
