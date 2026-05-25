import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../db';

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  accountId?: number;
  userName?: string;
}

function resolveUser(userId: number) {
  return db.prepare('SELECT role, account_id, name FROM users WHERE id = ?').get(userId) as { role: string; account_id: number; name: string } | undefined;
}

function extractToken(req: Request): string | null {
  const h = req.headers.authorization;
  return h?.startsWith('Bearer ') ? h.slice(7) : null;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) { res.status(401).json({ message: 'Unauthorized' }); return; }
  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const user = resolveUser(userId);
    req.userId = userId;
    req.accountId = user?.account_id;
    req.userRole = user?.role;
    req.userName = user?.name;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) { res.status(401).json({ message: 'Unauthorized' }); return; }
  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
    const user = resolveUser(userId);
    if (!user || user.role !== 'admin') { res.status(403).json({ message: 'Admin access required' }); return; }
    req.userId = userId;
    req.accountId = user.account_id;
    req.userRole = 'admin';
    req.userName = user.name;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
}
