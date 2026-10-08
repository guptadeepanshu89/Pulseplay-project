import { NextFunction, Request, Response } from 'express';

// A failure the API deliberately reports. `error` stays a plain string (the
// mobile client parses `data.error`); `code` is the stable machine value.
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

// Central error handler — routes throw/reject, they never format failures
// themselves (asyncHandler forwards rejected promises here).
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: err.message, code: err.code, ...(err.details !== undefined ? { details: err.details } : {}) });
    return;
  }

  const type = (err as { type?: string }).type;
  if (type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Malformed JSON body', code: 'INVALID_JSON' });
    return;
  }
  if (type === 'entity.too.large') {
    res.status(413).json({ error: 'Request body too large', code: 'PAYLOAD_TOO_LARGE' });
    return;
  }
  // A unique-constraint race (two requests inserting the same email) is a conflict, not a crash.
  if ((err as { code?: string }).code === 'P2002') {
    res.status(409).json({ error: 'A record with these values already exists', code: 'CONFLICT' });
    return;
  }

  console.error(err);
  res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}
