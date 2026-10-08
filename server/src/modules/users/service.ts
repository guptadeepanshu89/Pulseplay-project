import { Prisma } from '@prisma/client';

import { Actor, clientIdOf } from '../../core/actor';
import { AppError } from '../../core/errors';
import { Page, pageOf, skipTake } from '../../core/pagination';
import { assertCan } from '../../core/policies/assert';
import { clientScope, clientWhere } from '../../core/tenant';
import { generateTempPassword, hashPassword } from '../../core/password';
import { prisma } from '../../db';
import { LOOKUP_IDS } from '../../lib/lookupCache';
import { ROLE_IDS, roleCodeOf, RoleCode } from '../../lib/roleCache';
import { anonymisedAccount, assertContactFree, assertNotLastAdmin, conflictFromUniqueViolation, createAccount } from './accounts';
import { toAdminUserDto, userInclude, UserRow } from './dto';
import { CreateUserInput, ListUsersQuery, UpdateUserInput } from './schemas';

// The single tenant-safe way to load a target user: cross-tenant AND
// wrong-role targets (a SuperAdmin row is never manageable here) come back
// as the SAME 404 as a non-existent id — no existence leak either way.
async function fetchScopedUser(actor: Actor, id: number): Promise<UserRow> {
  const user = await prisma.user.findUnique({ where: { id }, include: userInclude });
  if (!user || user.isDeleted === 1 || roleCodeOf(user.roleId) === 'SUPER_ADMIN') {
    throw new AppError(404, 'NOT_FOUND', 'User not found');
  }
  const scope = clientScope(actor, undefined);
  if (scope !== undefined && user.clientId !== scope) throw new AppError(404, 'NOT_FOUND', 'User not found');
  return user;
}

const targetOf = (user: UserRow) => ({ role: roleCodeOf(user.roleId) as RoleCode, clientId: user.clientId, userId: user.id });

export async function createUser(actor: Actor, input: CreateUserInput) {
  const clientId = actor.role === 'SUPER_ADMIN' ? input.clientId! : clientIdOf(actor);
  assertCan('user.create', actor, { role: input.role, clientId });

  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client || client.isDeleted === 1) throw new AppError(404, 'NOT_FOUND', 'Client not found');
  if (client.isActive === 0) throw new AppError(409, 'CLIENT_INACTIVE', 'This client is inactive');

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    const created = await prisma.$transaction((tx) =>
      createAccount(tx, {
        name: input.name,
        email: input.email,
        mobile: input.mobile,
        role: input.role,
        clientId,
        passwordHash,
        createdByUserId: actor.userId,
      }),
    );
    const full = await prisma.user.findUniqueOrThrow({ where: { id: created.id }, include: userInclude });
    return { user: toAdminUserDto(full), temporaryPassword };
  } catch (error) {
    throw conflictFromUniqueViolation(error) ?? error;
  }
}

export async function listUsers(actor: Actor, query: ListUsersQuery): Promise<Page<ReturnType<typeof toAdminUserDto>>> {
  // SA is allowed regardless of target; CA's scope is always their own client (the query
  // schema never lets a CA pass someone else's), so this is always true for both roles —
  // asserted anyway as defense-in-depth rather than trusting that alone.
  const scope = clientScope(actor, query.clientId);
  assertCan('user.view', actor, { clientId: scope });

  const where: Prisma.UserWhereInput = {
    isDeleted: 0,
    roleId: query.role ? ROLE_IDS[query.role] : { in: [ROLE_IDS.CLIENT_ADMIN, ROLE_IDS.CLIENT_USER] },
    ...clientWhere(scope),
    ...(query.isActive !== undefined && { isActive: query.isActive ? 1 : 0 }),
    ...(query.search && {
      OR: [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { mobile: { contains: query.search } },
        { userCode: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.user.findMany({ where, include: userInclude, orderBy: { [query.sort]: query.order }, ...skipTake(query) }),
    prisma.user.count({ where }),
  ]);
  return pageOf(items.map(toAdminUserDto), total, query);
}

export async function getUser(actor: Actor, id: number) {
  const user = await fetchScopedUser(actor, id);
  assertCan('user.view', actor, targetOf(user));
  return toAdminUserDto(user);
}

export async function updateUser(actor: Actor, id: number, input: UpdateUserInput) {
  const user = await fetchScopedUser(actor, id);
  assertCan('user.update', actor, targetOf(user));

  try {
    await prisma.$transaction(async (tx) => {
      await assertContactFree(tx, input, user.id);
      await tx.user.update({ where: { id }, data: { ...input, modifiedByUserId: actor.userId } });
    });
  } catch (error) {
    throw conflictFromUniqueViolation(error) ?? error;
  }
  return getUser(actor, id);
}

export async function setUserActive(actor: Actor, id: number, active: boolean) {
  const user = await fetchScopedUser(actor, id);
  assertCan('user.block', actor, targetOf(user));

  await prisma.$transaction(async (tx) => {
    if (!active && roleCodeOf(user.roleId) === 'CLIENT_ADMIN') {
      await assertNotLastAdmin(tx, { id: user.id, clientId: user.clientId });
    }
    await tx.user.update({ where: { id }, data: { isActive: active ? 1 : 0, modifiedByUserId: actor.userId } });
  });
  return getUser(actor, id);
}

export async function resetUserPassword(actor: Actor, id: number) {
  const user = await fetchScopedUser(actor, id);
  assertCan('user.resetPassword', actor, targetOf(user));

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  await prisma.user.update({
    where: { id },
    data: { passwordHash, mustChangePassword: 1, passwordChangedAt: new Date(), modifiedByUserId: actor.userId },
  });
  return { temporaryPassword };
}

export async function deleteUser(actor: Actor, id: number): Promise<void> {
  const user = await fetchScopedUser(actor, id);
  assertCan('user.delete', actor, targetOf(user));
  const role = roleCodeOf(user.roleId);

  await prisma.$transaction(async (tx) => {
    if (role === 'CLIENT_ADMIN') {
      await assertNotLastAdmin(tx, { id: user.id, clientId: user.clientId });
    } else {
      const wallet = await tx.wallet.findUnique({ where: { userId: id } });
      if (wallet && (wallet.availableBalance.toNumber() !== 0 || wallet.lockedBalance.toNumber() !== 0)) {
        throw new AppError(409, 'WALLET_NOT_EMPTY', 'This player still has funds in their wallet — settle the balance first');
      }
      const openBet = await tx.bet.findFirst({ where: { userId: id, statusId: LOOKUP_IDS.BET_STATUS.OPEN } });
      if (openBet) throw new AppError(409, 'HAS_OPEN_BETS', 'This player has an open bet');
      const pendingRequest = await tx.walletRequest.findFirst({ where: { userId: id, statusId: LOOKUP_IDS.WALLET_REQUEST_STATUS.PENDING } });
      if (pendingRequest) throw new AppError(409, 'HAS_PENDING_REQUESTS', 'This player has a pending fund request');
    }
    await tx.user.update({ where: { id }, data: anonymisedAccount(id, actor.userId) });
  });
}
