import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getArtifacts = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { type, limit = 50, page = 1 } = req.query;
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const where: any = {
      user_id: user.id
    };
    
    if (type) {
      where.type = type;
    }
    
    const [artifacts, total] = await Promise.all([
      prisma.userArtifact.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: Number(limit),
        skip,
        select: {
            id: true,
            type: true,
            title: true,
            content: true,
            created_at: true,
            metadata: true
        }
      }),
      prisma.userArtifact.count({ where })
    ]);
    
    res.json({
      data: artifacts,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit))
      }
    });
    
  } catch (error) {
    console.error('Error fetching artifacts:', error);
    res.status(500).json({ error: 'Failed to fetch artifacts' });
  }
};

export const getArtifact = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = (req as any).user;
    
    const artifact = await prisma.userArtifact.findFirst({
      where: {
        id,
        user_id: user.id
      }
    });
    
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }
    
    res.json(artifact);
    
  } catch (error) {
    console.error('Error fetching artifact:', error);
    res.status(500).json({ error: 'Failed to fetch artifact' });
  }
};

export const deleteArtifact = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = (req as any).user;
    
    if (!id) {
        return res.status(400).json({ error: 'ID is required' });
    }

    const artifact = await prisma.userArtifact.findFirst({
        where: { id, user_id: user.id }
    });

    if (!artifact) {
        return res.status(404).json({ error: 'Artifact not found' });
    }

    await prisma.userArtifact.delete({
      where: { id }
    });
    
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error deleting artifact:', error);
    res.status(500).json({ error: 'Failed to delete artifact' });
  }
};
