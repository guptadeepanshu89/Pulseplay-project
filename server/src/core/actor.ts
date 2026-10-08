import { Request } from 'express';

import { AppError } from './errors';
import { RoleCode } from '../lib/roleCache';

export type AppKind = 'mobile' | 'admin';

// Who is making this request, as the database says right now — never as the
// (possibly stale) token claims. Built on every authenticated request.
export interface Actor {
  userId: number;
  role: RoleCode;
  roleId: number;
  // NULL only for SUPER_ADMIN (a DB trigger guarantees it).
  clientId: number | null;
  app: AppKind;
  mustChangePassword: boolean;
}

export interface AuthedRequest extends Request {
  actor?: Actor;
}

export function actorOf(req: AuthedRequest): Actor {
  if (!req.actor) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  return req.actor;
}

// For code paths reserved for tenant-bound roles: fail loudly rather than
// hand a NULL to a tenant filter.
export function clientIdOf(actor: Actor): number {
  if (actor.clientId === null) {
    throw new AppError(403, 'FORBIDDEN', 'This action requires a user that belongs to a client');
  }
  return actor.clientId;
}
