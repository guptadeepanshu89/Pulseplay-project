import bcrypt from 'bcryptjs';
import { createHash, randomBytes } from 'crypto';

import { prisma } from '../../db';
import { env } from '../../env';
import { Actor, AppKind } from '../../core/actor';
import { AppError } from '../../core/errors';
import { hashPassword } from '../../core/password';
import { passwordVersionOf, signToken } from '../../core/tokens';
import { roleCodeOf } from '../../lib/roleCache';
import { LoginInput } from './schemas';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const hashResetToken = (token: string) => createHash('sha256').update(token).digest('hex');

// Compared against when no user matches, so "no such user" and "wrong
// password" cost the same and can't be told apart by response time.
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-constant-time-comparison', env.bcryptCost);

type UserRow = {
  id: number;
  name: string;
  userCode: string;
  email: string;
  mobile: string;
  avatarUrl: string | null;
  roleId: number;
  mustChangePassword: number;
  client: { id: number; code: string; name: string } | null;
};

export function toUserDto(user: UserRow) {
  return {
    id: user.id,
    name: user.name,
    userCode: user.userCode,
    email: user.email,
    mobile: user.mobile,
    avatarUrl: user.avatarUrl ?? undefined,
    role: roleCodeOf(user.roleId),
    mustChangePassword: user.mustChangePassword === 1,
    client: user.client ? { id: user.client.id, code: user.client.code, name: user.client.name } : null,
  };
}

// Which roles may sign in through which app: players use the mobile app, staff use the panel.
const ROLES_FOR_APP: Record<AppKind, string[]> = {
  mobile: ['CLIENT_USER'],
  admin: ['SUPER_ADMIN', 'CLIENT_ADMIN'],
};

export async function login({ identifier, password, app }: LoginInput, ip: string | undefined) {
  const user = await prisma.user.findFirst({
    where: { isDeleted: 0, OR: [{ email: identifier.toLowerCase() }, { mobile: identifier }] },
    include: { client: { select: { id: true, code: true, name: true, isActive: true, isDeleted: true } } },
  });

  const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !passwordOk) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }

  // Account state is revealed only now, after the password proved the caller
  // knows this account — otherwise "blocked" would confirm an identifier exists.
  if (user.client?.isDeleted === 1) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  if (user.isActive === 0) throw new AppError(403, 'ACCOUNT_BLOCKED', 'This account has been blocked');
  if (user.client && user.client.isActive === 0) throw new AppError(403, 'CLIENT_INACTIVE', 'This account\'s client is inactive');
  if (!ROLES_FOR_APP[app].includes(roleCodeOf(user.roleId))) {
    throw new AppError(403, 'WRONG_APP', app === 'admin' ? 'Use the mobile app to sign in with this account' : 'Use the admin panel to sign in with this account');
  }

  await prisma.user.update({ where: { id: user.id }, data: { ipAddress: ip, lastLoginAt: new Date() } });

  const token = signToken({ userId: user.id, app, passwordVersion: passwordVersionOf(user.passwordChangedAt) });
  return { token, user: toUserDto(user) };
}

export async function getMe(actor: Actor) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: actor.userId },
    include: { client: { select: { id: true, code: true, name: true } } },
  });
  return toUserDto(user);
}

export async function changePassword(actor: Actor, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId }, select: { passwordHash: true } });

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(400, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
  }
  if (currentPassword === newPassword) {
    throw new AppError(400, 'PASSWORD_UNCHANGED', 'New password must be different from the current one');
  }

  const passwordChangedAt = new Date();
  await prisma.user.update({
    where: { id: actor.userId },
    data: {
      passwordHash: await hashPassword(newPassword),
      passwordChangedAt,
      mustChangePassword: 0,
      modifiedByUserId: actor.userId,
    },
  });

  // Every older token is now stale; hand back a fresh one so this session carries on.
  return signToken({ userId: actor.userId, app: actor.app, passwordVersion: passwordVersionOf(passwordChangedAt) });
}

// Always returns the same shape — never reveals whether an account exists.
// No email/SMS provider is configured; the plaintext token is logged once for ops/dev delivery.
export async function requestPasswordReset(identifier: string): Promise<{ ok: true }> {
  const user = await prisma.user.findFirst({
    where: {
      isDeleted: 0,
      isActive: 1,
      OR: [{ email: identifier.toLowerCase() }, { mobile: identifier }],
      Role: { code: 'CLIENT_USER' },
    },
    select: { id: true },
  });

  if (!user) return { ok: true };

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashResetToken(token), expiresAt },
    }),
  ]);

  // Delivery provider not configured — surface the token in server logs only.
  console.warn(
    `[forgot-password] No email/SMS provider configured. Reset token for userId=${user.id} (expires ${expiresAt.toISOString()}): ${token}`,
  );

  return { ok: true };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashResetToken(token);
  const row = await prisma.passwordResetToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, userId: true },
  });
  if (!row) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'Reset token is invalid or has expired');
  }

  const passwordChangedAt = new Date();
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: passwordChangedAt } }),
    prisma.passwordResetToken.updateMany({
      where: { userId: row.userId, usedAt: null, id: { not: row.id } },
      data: { usedAt: passwordChangedAt },
    }),
    prisma.user.update({
      where: { id: row.userId },
      data: {
        passwordHash,
        passwordChangedAt,
        mustChangePassword: 0,
        modifiedByUserId: row.userId,
      },
    }),
  ]);
}
