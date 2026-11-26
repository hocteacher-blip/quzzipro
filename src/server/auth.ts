import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { UserProfile, UserRole } from '../types/arena.ts';

const SESSION_SIGNING_KEY = process.env.SESSION_SECRET
  ? Buffer.from(process.env.SESSION_SECRET, 'utf-8')
  : crypto.randomBytes(32);

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const keyBuffer = Buffer.from(keyHex, 'hex');
  const derivedBuffer = crypto.scryptSync(password, salt, 64);
  if (keyBuffer.length !== derivedBuffer.length) return false;
  return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
}

export interface TokenPayload {
  userId: string;
  role: UserRole;
  exp: number;
}

export function signAuthToken(userId: string, role: UserRole, ttlMs = 12 * 60 * 60 * 1000): string {
  const payload: TokenPayload = {
    userId,
    role,
    exp: Date.now() + ttlMs,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

export function verifyAuthToken(token: string): TokenPayload | null {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SIGNING_KEY)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8')) as TokenPayload;
    if (!decoded.userId || !decoded.exp || Date.now() > decoded.exp) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

export function createAuthMiddleware(getUserById: (id: string) => UserProfile | null) {
  const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Yêu cầu đăng nhập để thực hiện thao tác này.' });
      return;
    }
    const token = authHeader.slice(7).trim();
    const payload = verifyAuthToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.' });
      return;
    }
    const user = getUserById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'Không tìm thấy tài khoản người dùng.' });
      return;
    }
    if (user.isLocked) {
      res.status(403).json({ error: 'Tài khoản của bạn đã bị khóa bởi Quản trị viên.' });
      return;
    }
    req.user = user;
    next();
  };

  const requireRole = (allowedRoles: UserRole[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user) {
        res.status(401).json({ error: 'Chưa xác thực người dùng.' });
        return;
      }
      if (!allowedRoles.includes(req.user.role)) {
        res.status(403).json({
          error: `Truy cập bị từ chối. Chức năng này yêu cầu quyền: ${allowedRoles.join(' hoặc ')}.`,
        });
        return;
      }
      next();
    };
  };

  return { requireAuth, requireRole };
}
