import type { ErrorRequestHandler, Request, Response, NextFunction } from 'express';
import { ERROR_CODES, type ErrorCode } from '@smart-factory/types';

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export function httpError(status: number, code: ErrorCode, message: string): HttpError {
  return new HttpError(status, code, message);
}

// Convenience helpers matching contracts/rest-api.md status semantics (D9).
export const badRequest = (message: string) =>
  httpError(400, ERROR_CODES.VALIDATION, message);
export const unauthorized = (message = 'Authentication required') =>
  httpError(401, ERROR_CODES.UNAUTHORIZED, message);
export const forbidden = (message = 'You do not have permission to do that') =>
  httpError(403, ERROR_CODES.FORBIDDEN, message);
export const notFound = (message = 'Not found') =>
  httpError(404, ERROR_CODES.NOT_FOUND, message);
export const conflict = (code: ErrorCode, message: string) =>
  httpError(409, code, message);

export const errorMiddleware: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Internal server error' },
  });
};
