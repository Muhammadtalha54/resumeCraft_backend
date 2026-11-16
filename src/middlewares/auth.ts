import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/db';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    plan: string;
    status: string;
    resumeCredits: number;
    atsCredits: number;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      code: 'NO_TOKEN',
      message: 'Authentication failed. Please log in to continue.'
    });
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;

    const dbUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        plan: true,
        status: true,
        resumeCredits: true,
        atsCredits: true
      }
    });

    if (!dbUser) {
      return res.status(401).json({
        success: false,
        code: 'USER_NOT_FOUND',
        message: 'Account not found. Please register or log in again.'
      });
    }

    if (dbUser.status === 'BLOCKED') {
      return res.status(403).json({
        success: false,
        code: 'USER_BLOCKED',
        message: 'Your account has been blocked by the Administrator. Access denied.'
      });
    }

    req.user = dbUser;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      code: 'TOKEN_EXPIRED',
      message: 'Session expired. Please log in again.'
    });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      code: 'ADMIN_REQUIRED',
      message: 'Access denied. Administrator privileges required.'
    });
  }
  next();
};
