import { NextFunction, Response } from 'express';

import { RoleCode } from '../../lib/roleCache';
import { actorOf, AuthedRequest } from '../actor';
import { AppError } from '../errors';

// Coarse gate at the router level ("is this role allowed on this endpoint
// at all"). Object-level rules — same tenant, target's role, ... — live in
// core/policies and are enforced by the services.
export function requireRole(...roles: RoleCode[]) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    try {
      const actor = actorOf(req);
      if (!roles.includes(actor.role)) {
        throw new AppError(403, 'FORBIDDEN', 'You do not have access to this resource');
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
