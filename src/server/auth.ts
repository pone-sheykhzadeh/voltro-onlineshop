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

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'احراز هویت الزامی است. لطفاً ابتدا وارد حساب کاربری خود شوید.' });
  }

  // 1. Try local HMAC token first
  const payload = verifyToken(token);
  if (payload) {
    let user = db.getUserById(payload.userId);
    if (!user && payload.email) {
      user = db.getUserByEmail(payload.email);
    }
    if (!user) {
      user = {
        id: payload.userId,
        name: payload.email ? payload.email.split('@')[0] : 'کاربر ولترو',
        email: payload.email,
        role: (payload.role as any) || 'customer',
        salt: '',
        passwordHash: '',
        createdAt: new Date().toISOString(),
      };
    }
    req.user = user;
    return next();
  }

  // 2. Try Supabase Auth Token (handles Google OAuth & Supabase Auth direct sessions)
  try {
    const { getSupabaseClient } = await import('./supabase.ts');
    const supabase = getSupabaseClient();
    if (supabase) {
      const { data: authData, error: authError } = await supabase.auth.getUser(token);
      if (authData?.user && !authError) {
        const suUser = authData.user;
        const email = (suUser.email || '').trim().toLowerCase();
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, name, phone, avatar_url')
          .eq('auth_id', suUser.id)
          .maybeSingle();

        const role = profile?.role || (email === 'admin@voltro.ir' ? 'admin' : 'customer');
        const name = profile?.name || suUser.user_metadata?.full_name || suUser.user_metadata?.name || email.split('@')[0];

        req.user = {
          id: suUser.id,
          email,
          name,
          role,
          phone: profile?.phone || suUser.user_metadata?.phone,
          avatar: profile?.avatar_url || suUser.user_metadata?.avatar_url || suUser.user_metadata?.picture,
          salt: '',
          passwordHash: '',
          createdAt: suUser.created_at || new Date().toISOString(),
        };
        return next();
      }
    }
  } catch (err) {
    // fallback to invalid session
  }

  return res.status(401).json({ error: 'نشست کاربری نامعتبر است یا منقضی شده است.' });
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'دسترسی غیرمجاز. تنها مدیران سامانه به این بخش دسترسی دارند.' });
  }
  next();
}

export async function optionalAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (token) {
    const payload = verifyToken(token);
    if (payload) {
      const user = db.getUserById(payload.userId);
      if (user) {
        req.user = user;
      }
      return next();
    }

    try {
      const { getSupabaseClient } = await import('./supabase.ts');
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data: authData } = await supabase.auth.getUser(token);
        if (authData?.user) {
          const suUser = authData.user;
          const email = (suUser.email || '').trim().toLowerCase();
          const { data: profile } = await supabase
            .from('user_profiles')
            .select('role, name, phone, avatar_url')
            .eq('auth_id', suUser.id)
            .maybeSingle();

          req.user = {
            id: suUser.id,
            email,
            name: profile?.name || suUser.user_metadata?.full_name || suUser.user_metadata?.name || email.split('@')[0],
            role: profile?.role || (email === 'admin@voltro.ir' ? 'admin' : 'customer'),
            phone: profile?.phone || suUser.user_metadata?.phone,
            avatar: profile?.avatar_url || suUser.user_metadata?.avatar_url || suUser.user_metadata?.picture,
            salt: '',
            passwordHash: '',
            createdAt: suUser.created_at || new Date().toISOString(),
          };
        }
      }
    } catch {
      // ignore in optional auth
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
