import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getUsage = async (req: Request, res: Response) => {
  try {
    const user_id = req.user?.id;
    const { feature } = req.query;

    if (!user_id) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    if (!feature || typeof feature !== 'string') {
      return res.status(400).json({ error: "Feature parameter is required" });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get usage for today
    const usage = await prisma.usageTracking.findUnique({
      where: {
        user_id_feature_date: {
          user_id,
          feature,
          date: today
        }
      }
    });

    // Get plan limits
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
    let max_limit = 50; // Default

    if (plan) {
      if (feature === 'chat_message') {
        max_limit = plan.max_chats_per_day;
      } else if (feature === 'document_upload') {
        max_limit = plan.max_documents;
      }
    }

    res.json({
      current_usage: usage?.count || 0,
      max_limit
    });

  } catch (error: any) {
    console.error("Get usage error:", error);
    res.status(500).json({ error: "Failed to fetch usage data", details: error.message });
  }
};
