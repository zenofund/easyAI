import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const updateSubscription = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, plan_id, start_date, end_date, auto_renew } = req.body;
    const userId = (req as any).user.id;

    // Check if subscription exists
    const subscription = await prisma.subscription.findUnique({
      where: { id: id as string }
    });

    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Check permissions (only owner or admin can update)
    // For simplicity, we'll allow update if it matches the user or if we had admin check middleware
    // But in SubscriptionDetailsModal, it seems to be used by Admin.
    // The current auth middleware puts user info in req.user
    
    // Fetch requesting user to check role
    const requestingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!requestingUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Allow if admin or if it's their own subscription
    if (requestingUser.role !== 'admin' && requestingUser.role !== 'super_admin' && subscription.user_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const updatedSubscription = await prisma.subscription.update({
      where: { id: id as string },
      data: {
        status,
        plan_id,
        start_date: start_date ? new Date(start_date) : undefined,
        end_date: end_date ? new Date(end_date) : undefined,
        auto_renew
      }
    });

    res.json(updatedSubscription);
  } catch (error) {
    console.error('Error updating subscription:', error);
    res.status(500).json({ error: 'Failed to update subscription' });
  }
};
