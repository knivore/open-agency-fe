import type { ApiError as ApiErrorType } from '@/types/api';

export class ApiError extends Error implements ApiErrorType {
  status: number;
  code?: string;
  details?: unknown;
  raw?: unknown;

  constructor({ status, message, code, details, raw }: ApiErrorType) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.raw = raw;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
