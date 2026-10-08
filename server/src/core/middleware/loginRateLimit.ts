import { NextFunction, Request, RequestHandler, Response } from 'express';
import rateLimit from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000;

function limiter(limit: number, keyOf: (req: Request) => string): RequestHandler {
  return rateLimit({
    windowMs: WINDOW_MS,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    // Only failed attempts count: a legitimate user logging in repeatedly is never throttled.
    skipSuccessfulRequests: true,
    keyGenerator: keyOf,
    validate: { keyGeneratorIpFallback: false },
    handler: (_req: Request, res: Response) => {
      res.status(429).json({ error: 'Too many failed login attempts — try again later', code: 'RATE_LIMITED' });
    },
  });
}

const identifierOf = (req: Request) => String(req.body?.identifier ?? '').trim().toLowerCase();

// Per (ip, identifier): stops password guessing against one account from one
// place without letting an attacker lock a victim out from somewhere else.
const perAccount = limiter(10, (req) => `${req.ip}|${identifierOf(req)}`);
// Per ip: stops one address spraying guesses across many accounts.
const perIp = limiter(100, (req) => `${req.ip}`);

export const loginRateLimit: RequestHandler[] = [
  (req: Request, res: Response, next: NextFunction) => perIp(req, res, next),
  (req: Request, res: Response, next: NextFunction) => perAccount(req, res, next),
];
