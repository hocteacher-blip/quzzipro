import type { Request, Response, NextFunction } from 'express';

interface RateBucket {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  message?: string;
}) {
  const buckets = new Map<string, RateBucket>();

  // Periodic cleanup to avoid memory growth
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets.entries()) {
      if (now > v.resetAt) {
        buckets.delete(k);
      }
    }
  }, Math.max(30000, options.windowMs));
  cleanupTimer.unref?.();

  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization || '';
    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const identityKey = authHeader ? authHeader.slice(-24) : clientIp;
    const bucketKey = `${options.keyPrefix}:${identityKey}`;

    const now = Date.now();
    const existing = buckets.get(bucketKey);

    if (!existing || now > existing.resetAt) {
      buckets.set(bucketKey, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(options.maxRequests - 1));
      next();
      return;
    }

    existing.count += 1;
    const remaining = Math.max(0, options.maxRequests - existing.count);
    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (existing.count > options.maxRequests) {
      res.status(429).json({
        error:
          options.message ||
          'Tần suất gửi yêu cầu vượt quá giới hạn cho phép. Vui lòng thử lại sau ít giây.',
        code: 'RATE_LIMIT_EXCEEDED',
      });
      return;
    }

    next();
  };
}
