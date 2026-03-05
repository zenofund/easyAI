import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('CRITICAL: JWT_SECRET is not defined in environment variables!');
}

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    // console.log('Auth header:', authHeader);

    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.split(' ')[1]; // Bearer <token>

    if (!token) {
      return res.status(401).json({ error: 'Invalid authorization format' });
    }

    if (!JWT_SECRET) {
      console.error('JWT_SECRET missing during request');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    
    // Optional: Check if user still exists in DB
    try {
      const user = await prisma.user.findUnique({ where: { id: decoded.id } });

      if (!user) {
        return res.status(401).json({ error: 'User not found or token invalid' });
      }

      req.user = user;
      next();
    } catch (dbError: any) {
      console.error('Database error in auth middleware:', dbError);
      // Return 503 Service Unavailable if DB is down, instead of 401 Unauthorized
      return res.status(503).json({ 
        error: 'Service temporarily unavailable', 
        details: dbError.message || 'Database connection failed' 
      });
    }
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  next();
};

export const requireSuperAdmin = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Access denied. Super Admin privileges required.' });
  }

  next();
};
