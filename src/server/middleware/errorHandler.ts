import type { Request, Response, NextFunction } from 'express';
import { ApiValidationError } from './validation.ts';

export function centralizedErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (res.headersSent) {
    return;
  }

  if (err instanceof ApiValidationError) {
    res.status(err.statusCode).json({
      error: err.message,
      code: err.code,
    });
    return;
  }

  const statusCode =
    typeof err?.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;

  res.status(statusCode).json({
    error: err?.message || 'Đã xảy ra lỗi không xác định tại máy chủ.',
    code: err?.code || 'INTERNAL_SERVER_ERROR',
  });
}
