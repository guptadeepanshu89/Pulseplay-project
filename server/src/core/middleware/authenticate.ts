import { NextFunction, Response } from 'express';

import { prisma } from '../../db';
import { roleCodeOf } from '../../lib/roleCache';
import { Actor, AppKind, AuthedRequest } from '../actor';
import { AppError } from '../errors';
import { COOKIE_NAME, passwordVersionOf, TokenClaims, verifyToken } from '../tokens';

interface AuthOptions {
  // /auth/me, /auth/change-password: the only things a user who still holds a
  // temporary password may do.
  allowPasswordChangePending?: boolean;
}

const unauthenticated = () => new AppError(401, 'UNAUTHENTICATED', 'Authentication required');

// Where a token may come from: a Bearer header (native mobile) or the cookie of
// an app this route accepts. A token found in app X's cookie must also *claim*
// app X, so a token can't be smuggled across apps by copying it between cookies.
function candidateClaims(req: AuthedRequest, apps: AppKind[]): TokenClaims[] {
  const claims: TokenClaims[] = [];
  const header = req.get('Authorization');
  if (header?.startsWith('Bearer ')) {
    const claim = verifyToken(header.slice('Bearer '.length));
    if (claim && apps.includes(claim.app)) claims.push(claim);
    return claims;
  }
  for (const app of apps) {
    const token = req.cookies?.[COOKIE_NAME[app]];
    if (typeof token !== 'string') continue;
    const claim = verifyToken(token);
    if (claim && claim.app === app) claims.push(claim);
  }
  return claims;
}

async function loadActor(claims: TokenClaims[]): Promise<Actor | 'stale'> {
  let sawStale = false;
  for (const claim of claims) {
    const user = await prisma.user.findUnique({
      where: { id: claim.userId },
      select: {
        id: true,
        roleId: true,
        clientId: true,
        isActive: true,
        isDeleted: true,
        mustChangePassword: true,
        passwordChangedAt: true,
        client: { select: { isActive: true, isDeleted: true } },
      },
    });

    // Everything below is re-checked against the DB on EVERY request, so a delete,
    // block, deactivated client or password change bites immediately instead of
    // whenever the (up to 7-day) token happens to expire.
    if (!user || user.isDeleted === 1) continue;
    if (claim.passwordVersion !== passwordVersionOf(user.passwordChangedAt)) {
      sawStale = true;
      continue;
    }
    if (user.client?.isDeleted === 1) continue;
    if (user.isActive === 0) throw new AppError(403, 'ACCOUNT_BLOCKED', 'This account has been blocked');
    if (user.client && user.client.isActive === 0) throw new AppError(403, 'CLIENT_INACTIVE', 'This account\'s client is inactive');

    return {
      userId: user.id,
      role: roleCodeOf(user.roleId),
      roleId: user.roleId,
      clientId: user.clientId,
      app: claim.app,
      mustChangePassword: user.mustChangePassword === 1,
    };
  }
  if (sawStale) return 'stale';
  throw unauthenticated();
}

export function authenticate(apps: AppKind[], options: AuthOptions = {}) {
  return (req: AuthedRequest, _res: Response, next: NextFunction) => {
    (async () => {
      const claims = candidateClaims(req, apps);
      if (claims.length === 0) throw unauthenticated();

      const actor = await loadActor(claims);
      if (actor === 'stale') throw new AppError(401, 'TOKEN_REVOKED', 'Your session is no longer valid — please sign in again');

      if (actor.mustChangePassword && !options.allowPasswordChangePending) {
        throw new AppError(403, 'PASSWORD_CHANGE_REQUIRED', 'You must change your temporary password first');
      }
      req.actor = actor;
    })().then(() => next(), next);
  };
}
