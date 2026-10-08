import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';

import { AppError } from '../errors';

const formatIssues = (error: ZodError) => error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));

// Parse `input` with `schema` or throw the standard 400. Handlers use it for
// query strings; validateBody wraps it for bodies.
export function parseWith<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AppError(400, 'VALIDATION_ERROR', 'Validation failed', formatIssues(result.error));
  return result.data;
}

// Validates and replaces req.body. Schemas are written `.strict()`, so an
// unexpected key (roleId, clientId, isDeleted, ...) is a 400, not silently
// ignored — the mass-assignment defence. Pass a function when the shape
// depends on who is asking (e.g. only a SuperAdmin may name a clientId).
export function validateBody<T>(schema: ZodType<T> | ((req: Request) => ZodType<T>)) {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.body = parseWith(typeof schema === 'function' ? schema(req) : schema, req.body ?? {});
      next();
    } catch (error) {
      next(error);
    }
  };
}
