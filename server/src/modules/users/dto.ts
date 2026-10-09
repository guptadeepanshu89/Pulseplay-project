import { Prisma } from '@prisma/client';

import { roleCodeOf } from '../../lib/roleCache';

// The shape the admin panel sees. Flags are booleans here (they are 0/1 in the
// database); nothing secret (hash) or purely internal (roleId, audit FKs) is included.

export const userInclude = { client: { select: { id: true, code: true, name: true } } } satisfies Prisma.UserInclude;
export type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export type UserStats = { wallet: number; winning: number; loss: number };

export function toAdminUserDto(user: UserRow, stats: UserStats = { wallet: 0, winning: 0, loss: 0 }) {
  return {
    id: user.id,
    name: user.name,
    userCode: user.userCode,
    email: user.email,
    mobile: user.mobile,
    role: roleCodeOf(user.roleId),
    client: user.client,
    isActive: user.isActive === 1,
    mustChangePassword: user.mustChangePassword === 1,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    wallet: stats.wallet,
    winning: stats.winning,
    loss: stats.loss,
  };
}
