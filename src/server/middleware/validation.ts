import type { Request } from 'express';

export class ApiValidationError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 400, code = 'VALIDATION_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
}

export function parsePagination(req: Request, defaultLimit = 20, maxLimit = 100): PaginationParams {
  const rawPage = Number(req.query.page);
  const rawLimit = Number(req.query.limit);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit =
    Number.isInteger(rawLimit) && rawLimit > 0 ? Math.min(maxLimit, rawLimit) : defaultLimit;
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

export function requireNonEmptyString(val: unknown, fieldLabel: string, minLen = 1, maxLen = 1000): string {
  if (typeof val !== 'string') {
    throw new ApiValidationError(`${fieldLabel} không hợp lệ.`);
  }
  const trimmed = val.trim();
  if (trimmed.length < minLen) {
    throw new ApiValidationError(`${fieldLabel} phải có ít nhất ${minLen} ký tự.`);
  }
  if (trimmed.length > maxLen) {
    throw new ApiValidationError(`${fieldLabel} không được vượt quá ${maxLen} ký tự.`);
  }
  return trimmed;
}

export function requireIntInRange(val: unknown, fieldLabel: string, min: number, max: number): number {
  const num = Number(val);
  if (!Number.isInteger(num) || num < min || num > max) {
    throw new ApiValidationError(`${fieldLabel} phải là số nguyên trong khoảng [${min}, ${max}].`);
  }
  return num;
}
