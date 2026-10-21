import { prisma } from '../db';
import { roleCodeOf } from '../lib/roleCache';
import type { Actor } from '../core/actor';
import { passwordVersionOf, verifyToken, type TokenClaims } from '../core/tokens';

export type SocketAuthFailure = 'UNAUTHORIZED' | 'TOKEN_REVOKED' | 'ACCOUNT_BLOCKED' | 'CLIENT_INACTIVE';

export async function resolveSocketActor(token: string | null): Promise<{ ok: true; actor: Actor } | { ok: false; reason: SocketAuthFailure }> {
  if (!token) return { ok: false, reason: 'UNAUTHORIZED' };
  const claim = verifyToken(token);
  if (!claim) return { ok: false, reason: 'UNAUTHORIZED' };
  return loadSocketActor(claim);
}

export async function loadSocketActor(claim: TokenClaims): Promise<{ ok: true; actor: Actor } | { ok: false; reason: SocketAuthFailure }> {
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

  if (!user || user.isDeleted === 1) return { ok: false, reason: 'UNAUTHORIZED' };
  if (claim.passwordVersion !== passwordVersionOf(user.passwordChangedAt)) return { ok: false, reason: 'TOKEN_REVOKED' };
  if (user.client?.isDeleted === 1) return { ok: false, reason: 'UNAUTHORIZED' };
  if (user.isActive === 0) return { ok: false, reason: 'ACCOUNT_BLOCKED' };
  if (user.client && user.client.isActive === 0) return { ok: false, reason: 'CLIENT_INACTIVE' };

  return {
    ok: true,
    actor: {
      userId: user.id,
      role: roleCodeOf(user.roleId),
      roleId: user.roleId,
      clientId: user.clientId,
      app: claim.app,
      mustChangePassword: user.mustChangePassword === 1,
    },
  };
}

export async function marketIsSubscribable(marketId: number): Promise<boolean> {
  if (!Number.isInteger(marketId) || marketId <= 0) return false;
  const market = await prisma.market.findFirst({
    where: { id: marketId, isDeleted: 0 },
    select: { id: true },
  });
  return market !== null;
}
