import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: unknown;
}

/**
 * Central Express error handler.
 * Returns structured JSON errors; never leaks stack traces in production.
 */
export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const isProd = process.env.NODE_ENV === 'production';

  // Log all 5xx errors with full stack; 4xx at debug level
  if (statusCode >= 500) {
    logger.error('Server error', {
      method: req.method,
      url: req.url,
      statusCode,
      error: err.message,
      stack: err.stack,
    });
  } else {
    logger.debug('Client error', {
      method: req.method,
      url: req.url,
      statusCode,
      error: err.message,
    });
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code ?? (statusCode === 500 ? 'INTERNAL_ERROR' : 'ERROR'),
      message: isProd && statusCode >= 500 ? 'An unexpected error occurred' : err.message,
      ...(err.details && !isProd ? { details: err.details } : {}),
    },
  });
}

/** Factory for creating typed application errors */
export function createError(
  message: string,
  statusCode: number,
  code: string,
  details?: unknown
): AppError {
  const err: AppError = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  err.details = details;
  return err;
}
