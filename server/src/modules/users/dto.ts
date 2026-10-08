import { Prisma } from '@prisma/client';

import { roleCodeOf } from '../../lib/roleCache';

// The shape the admin panel sees. Flags are booleans here (they are 0/1 in the
// database); nothing secret (hash) or purely internal (roleId, audit FKs) is included.

export const userInclude = { client: { select: { id: true, code: true, name: true } } } satisfies Prisma.UserInclude;
export type UserRow = Prisma.UserGetPayload<{ include: typeof userInclude }>;

export function toAdminUserDto(user: UserRow) {
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
  };
}
