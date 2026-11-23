import type { Request, Response, NextFunction } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { createError } from './errorHandler';

export function validateBody(schema: AnyZodObject) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(
          createError('Validation failed', 422, 'VALIDATION_ERROR', error.flatten().fieldErrors)
        );
      }
      next(error);
    }
  };
}

export function validateQuery(schema: AnyZodObject) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return next(
          createError('Invalid query parameters', 422, 'VALIDATION_ERROR', error.flatten().fieldErrors)
        );
      }
      next(error);
    }
  };
}
