
import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import nodemailer from 'nodemailer';
import { getTransporter } from '../lib/email';

export const getStats = async (req: Request, res: Response) => {
  try {
    const [
      usersCount,
      documentsCount,
      transactions,
      chatsCount,
      subscriptionsCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.document.count(),
      prisma.transaction.findMany({
        where: { status: 'success' },
        select: { amount: true }
      }),
      prisma.chat.count(),
      prisma.subscription.count({
        where: { status: 'active' }
      })
    ]);

    const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.amount), 0);

    res.json({
      totalUsers: usersCount,
      totalDocuments: documentsCount,
      totalRevenue,
      totalChats: chatsCount,
      activeSubscriptions: subscriptionsCount,
      monthlyGrowth: 12.5 // Placeholder as in original code
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
};

export const getRecentActivity = async (req: Request, res: Response) => {
  try {
    const [recentUsers, recentDocs, recentTransactions] = await Promise.all([
      prisma.user.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          created_at: true
        }
      }),
      prisma.document.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          title: true,
          uploaded_by: true,
          created_at: true,
          uploader: {
            select: {
              name: true,
              email: true
            }
          }
        }
      }),
      prisma.transaction.findMany({
        where: { status: 'success' },
        take: 5,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          amount: true,
          status: true,
          created_at: true,
          user: {
            select: {
              name: true,
              email: true
            }
          }
        }
      })
    ]);

    const activities: any[] = [];

    recentUsers.forEach(user => {
      activities.push({
        type: 'user',
        title: 'New user registered',
        description: user.name || user.email,
        timestamp: user.created_at,
        data: user
      });
    });

    recentDocs.forEach(doc => {
      activities.push({
        type: 'document',
        title: 'New document uploaded',
        description: doc.title,
        timestamp: doc.created_at,
        data: doc
      });
    });

    recentTransactions.forEach(tx => {
      activities.push({
        type: 'payment',
        title: 'New payment received',
        description: `${tx.user.name} paid ${tx.amount}`,
        timestamp: tx.created_at,
        data: tx
      });
    });

    // Sort all activities by timestamp desc
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.json(activities.slice(0, 10));
  } catch (error) {
    console.error('Error fetching admin activity:', error);
    res.status(500).json({ error: 'Failed to fetch admin activity' });
  }
};

export const getAllSubscriptions = async (req: Request, res: Response) => {
  try {
    const subscriptions = await prisma.subscription.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true
          }
        },
        plan: {
          select: {
            name: true,
            price: true,
            tier: true,
            billing_cycle: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    res.json(subscriptions);
  } catch (error) {
    console.error('Error fetching all subscriptions:', error);
    res.status(500).json({ error: 'Failed to fetch subscriptions' });
  }
};

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const notifications = await prisma.adminNotification.findMany({
      orderBy: {
        created_at: 'desc'
      }
    });

    res.json(notifications);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

export const createNotification = async (req: Request, res: Response) => {
  try {
    const { title, message, type, target_roles, expires_at, is_active } = req.body;

    if (!title || !message) {
      return res.status(400).json({ error: 'Title and message are required' });
    }

    const notification = await prisma.adminNotification.create({
      data: {
        title,
        message,
        type: type || 'info',
        target_roles: target_roles || ['user'],
        expires_at: expires_at ? new Date(expires_at) : null,
        is_active: is_active !== undefined ? is_active : true
      }
    });

    res.status(201).json(notification);
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
};

export const updateNotification = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { title, message, type, target_roles, expires_at, is_active } = req.body;

    const notification = await prisma.adminNotification.update({
      where: { id },
      data: {
        title,
        message,
        type,
        target_roles,
        expires_at: expires_at ? new Date(expires_at) : expires_at === null ? null : undefined,
        is_active
      }
    });

    res.json(notification);
  } catch (error) {
    console.error('Error updating notification:', error);
    res.status(500).json({ error: 'Failed to update notification' });
  }
};

export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;

    await prisma.adminNotification.delete({
      where: { id }
    });

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
};

export const getSmtpConfig = async (req: Request, res: Response) => {
  try {
    const config = await prisma.appConfig.findFirst();
    if (!config) {
      return res.json({});
    }
    const { smtp_pass, ...safeConfig } = config;
    res.json({ ...safeConfig, smtp_pass: smtp_pass ? '********' : '' });
  } catch (error) {
    console.error('Error fetching SMTP config:', error);
    res.status(500).json({ error: 'Failed to fetch SMTP config' });
  }
};

export const updateSmtpConfig = async (req: Request, res: Response) => {
  try {
    const { smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, smtp_from } = req.body;
    
    let config = await prisma.appConfig.findFirst();
    
    const data: any = {
      smtp_host,
      smtp_port: parseInt(smtp_port),
      smtp_user,
      smtp_secure: Boolean(smtp_secure),
      smtp_from
    };

    if (smtp_pass && smtp_pass !== '********') {
      data.smtp_pass = smtp_pass;
    }

    if (config) {
      await prisma.appConfig.update({
        where: { id: config.id },
        data
      });
    } else {
      await prisma.appConfig.create({
        data
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating SMTP config:', error);
    res.status(500).json({ error: 'Failed to update SMTP config' });
  }
};

export const sendTestEmail = async (req: Request, res: Response) => {
  try {
    const { to, config } = req.body;
    let transporter;

    if (config) {
      // If password is masked, fetch the actual password from DB
      if (config.smtp_pass === '********') {
        const dbConfig = await prisma.appConfig.findFirst();
        if (dbConfig && dbConfig.smtp_pass) {
          config.smtp_pass = dbConfig.smtp_pass;
        }
      }

      transporter = nodemailer.createTransport({
        host: config.smtp_host,
        port: parseInt(config.smtp_port),
        secure: config.smtp_secure,
        auth: {
          user: config.smtp_user,
          pass: config.smtp_pass
        }
      });
    } else {
      transporter = await getTransporter();
    }

    if (!transporter) {
      return res.status(400).json({ error: 'No SMTP configuration available' });
    }

    await transporter.sendMail({
      from: config?.smtp_from || 'noreply@legalassistant.com',
      to,
      subject: 'Test Email from Legal Assistant',
      html: '<p>This is a test email to verify your SMTP configuration.</p>'
    });

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error sending test email:', error);
    res.status(500).json({ error: error.message || 'Failed to send test email' });
  }
};

