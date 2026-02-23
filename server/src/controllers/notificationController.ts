import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getUserNotifications = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Get user role to filter notifications
    const userRole = user.role || 'user';

    // Fetch active notifications targeting the user's role
    const notifications = await prisma.adminNotification.findMany({
      where: {
        is_active: true,
        target_roles: {
          hasSome: [userRole, 'all']
        },
        OR: [
          { expires_at: null },
          { expires_at: { gt: new Date() } }
        ]
      },
      include: {
        reads: {
          where: {
            user_id: user.id
          },
          select: {
            read_at: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    const formattedNotifications = notifications.map(n => ({
      ...n,
      read: n.reads.length > 0,
      read_at: n.reads[0]?.read_at || null,
      reads: undefined // Remove the reads array from the response
    }));

    res.json(formattedNotifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const user = (req as any).user;

    await prisma.notificationRead.upsert({
      where: {
        user_id_notification_id: {
          user_id: user.id,
          notification_id: id
        }
      },
      update: {},
      create: {
        user: {
          connect: { id: user.id }
        },
        notification: {
          connect: { id }
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
};

export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const userRole = user.role || 'user';

    // Get all unread notifications for the user
    const unreadNotifications = await prisma.adminNotification.findMany({
      where: {
        is_active: true,
        target_roles: {
          hasSome: [userRole, 'all']
        },
        OR: [
          { expires_at: null },
          { expires_at: { gt: new Date() } }
        ],
        reads: {
          none: {
            user_id: user.id
          }
        }
      },
      select: {
        id: true
      }
    });

    // Create read records for all of them
    if (unreadNotifications.length > 0) {
      await prisma.notificationRead.createMany({
        data: unreadNotifications.map(n => ({
          user_id: user.id,
          notification_id: n.id
        })),
        skipDuplicates: true
      });
    }

    res.json({ success: true, count: unreadNotifications.length });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
};
