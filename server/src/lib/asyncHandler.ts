import { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Express 4 does not forward a rejected promise from an async route handler
 * to error-handling middleware — it becomes an unhandled rejection and can
 * crash the whole process (confirmed: an invalid Date in one route took the
 * entire server down, not just that request). Wrap every async handler with
 * this so any thrown/rejected error is routed to Express's error middleware
 * as a normal 500 instead.
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): RequestHandler {
  return (req, res, next) => {
    handler(req, res, next).catch(next);
  };
}
