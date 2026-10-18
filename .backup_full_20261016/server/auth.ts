import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { db, type StoredUser } from './db.ts';
import type { UserRole } from '../types/index.ts';

const JWT_SECRET = process.env.SESSION_SECRET || 'voltro-tech-luxury-secret-key-production-2025';

export interface TokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  exp: number;
}

export function createToken(user: StoredUser): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload: TokenPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 days
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${encodedPayload}`)
    .digest('base64url');

  return `${header}.${encodedPayload}.${signature}`;
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;

    const expectedSig = crypto
      .createHmac('sha256', JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const decodedPayload: TokenPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (decodedPayload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    return decodedPayload;
  } catch (err) {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: StoredUser;
}

export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'احراز هویت الزامی است. لطفاً ابتدا وارد حساب کاربری خود شوید.' });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'نشست کاربری نامعتبر است یا منقضی شده است.' });
  }

  const user = db.getUserById(payload.userId);
  if (!user) {
    return res.status(401).json({ error: 'کاربر یافت نشد.' });
  }

  req.user = user;
  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'دسترسی غیرمجاز. تنها مدیران سامانه به این بخش دسترسی دارند.' });
  }
  next();
}

export function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = db.getUserById(payload.userId);
      if (user) {
        req.user = user;
      }
    }
  }
  next();
}

// Simple in-memory rate limiter per IP
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export function rateLimiter(limit: number = 60, windowMs: number = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = requestCounts.get(ip);

    if (!entry || now > entry.resetAt) {
      requestCounts.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    if (entry.count >= limit) {
      return res.status(429).json({ error: 'تعداد درخواست‌ها بیش از حد مجاز است. لطفاً کمی بعد مجدداً تلاش نمایید.' });
    }

    entry.count += 1;
    next();
  };
}
