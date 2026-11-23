import type { Request, Response, NextFunction } from 'express';
import { createError } from './errorHandler';
import { UserRole } from '../models/User';

declare module 'express-session' {
  interface SessionData {
    userId?: string;
    role?: UserRole;
    email?: string;
  }
}

/**
 * Middleware that ensures the request is from an authenticated session.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.session || !req.session.userId) {
    return next(createError('Authentication required. Please log in.', 401, 'UNAUTHORIZED'));
  }
  next();
}

/**
 * Middleware factory that restricts access to users with specified roles.
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.session || !req.session.userId) {
      return next(createError('Authentication required. Please log in.', 401, 'UNAUTHORIZED'));
    }

    const userRole = req.session.role;
    if (!userRole || !allowedRoles.includes(userRole)) {
      return next(
        createError(
          `Access forbidden: requires one of [${allowedRoles.join(', ')}] role`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
}
