import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { PlanTier } from '@prisma/client';

export const getUsers = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    
    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Unauthorized: Admin access required' });
    }

    const users = await prisma.user.findMany({
      include: {
        subscriptions: {
          where: {
            status: 'active'
          },
          include: {
            plan: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Transform data to match client expectations if needed, but direct Prisma output is usually fine
    // Client expects `subscriptions` array with `plan` relation.
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const deleteUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.id;

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Unauthorized: Admin access required' });
    }

    // Prevent deleting self
    if (id === userId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id: id as string }
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
};

export const updateUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, role, planTier } = req.body;
    const userId = (req as any).user.id;

    // Check if user is admin
    const currentUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'super_admin')) {
      return res.status(403).json({ error: 'Unauthorized: Admin access required' });
    }

    // Only super_admin can set planTier manually
    if (planTier && currentUser.role !== 'super_admin') {
       return res.status(403).json({ error: 'Unauthorized: Only Super Admin can assign plans manually' });
    }

    // Use transaction to update user and handle plan assignment atomically
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update user basic info
      const user = await tx.user.update({
        where: { id: id as string },
        data: {
          name,
          role: role as any // Type assertion for UserRole enum
        }
      });

      // 2. Determine target plan
      // Priority: Manual plan assignment (Super Admin) > Role-based assignment
      let targetTier: PlanTier | null = null;
      
      if (planTier) {
         // Manual override
         if (planTier === 'free') targetTier = PlanTier.free;
         else if (planTier === 'pro') targetTier = PlanTier.pro;
         else if (planTier === 'enterprise') targetTier = PlanTier.enterprise;
         // if planTier is empty string or other value, we might want to cancel subscription or do nothing.
         // For now let's assume valid tiers.
      } else {
         // Fallback to role-based if no manual plan provided
         if (role === 'admin') targetTier = PlanTier.pro;
         else if (role === 'super_admin') targetTier = PlanTier.enterprise;
      }

      // 3. Handle Subscription Update if needed
      if (targetTier) {
        // Find the target plan
        const plan = await tx.plan.findFirst({
          where: { tier: targetTier }
        });

        if (plan) {
          // Check current active subscription
          const currentSubscription = await tx.subscription.findFirst({
            where: {
              user_id: user.id,
              status: 'active'
            },
            include: { plan: true }
          });

          // Only upgrade if not already on the correct plan tier
          if (!currentSubscription || currentSubscription.plan.tier !== targetTier) {
            // Cancel old subscription if exists
            if (currentSubscription) {
              await tx.subscription.update({
                where: { id: currentSubscription.id },
                data: { 
                  status: 'cancelled', 
                  end_date: new Date() 
                }
              });
            }

            // Create new subscription
            const newSubscription = await tx.subscription.create({
              data: {
                user_id: user.id,
                plan_id: plan.id,
                status: 'active',
                start_date: new Date(),
                auto_renew: true
              }
            });

            // Update user's subscription_id reference
            await tx.user.update({
              where: { id: user.id },
              data: { subscription_id: newSubscription.id }
            });
          }
        }
      } else if (planTier === '') {
          // If explicitly set to empty (no plan), cancel active subscription
          const currentSubscription = await tx.subscription.findFirst({
            where: {
              user_id: user.id,
              status: 'active'
            }
          });
          
          if (currentSubscription) {
             await tx.subscription.update({
                where: { id: currentSubscription.id },
                data: { 
                  status: 'cancelled', 
                  end_date: new Date() 
                }
              });
             
             await tx.user.update({
               where: { id: user.id },
               data: { subscription_id: null }
             });
          }
      }

      return user;
    });

    res.json(result);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
};
