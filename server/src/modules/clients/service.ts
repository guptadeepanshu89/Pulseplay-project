import { Prisma } from '@prisma/client';

import { Actor } from '../../core/actor';
import { AppError } from '../../core/errors';
import { Page, pageOf, skipTake } from '../../core/pagination';
import { assertCan } from '../../core/policies/assert';
import { hashPassword, generateTempPassword } from '../../core/password';
import { prisma } from '../../db';
import { LOOKUP_IDS } from '../../lib/lookupCache';
import { ROLE_IDS } from '../../lib/roleCache';
import { anonymisedAccount, conflictFromUniqueViolation, createAccount } from '../users/accounts';
import { toClientDto } from './dto';
import { CreateClientInput, ListClientsQuery, UpdateClientInput } from './schemas';

const codeConflict = () => new AppError(409, 'CODE_TAKEN', 'A client with this code already exists');

async function fetchClient(id: number) {
  const client = await prisma.client.findUnique({ where: { id } });
  if (!client || client.isDeleted === 1) throw new AppError(404, 'NOT_FOUND', 'Client not found');
  return client;
}

export async function createClient(actor: Actor, input: CreateClientInput) {
  assertCan('client.manage', actor);

  if (await prisma.client.findUnique({ where: { code: input.code } })) throw codeConflict();

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  try {
    // One transaction: a Client with no admin able to approve its users' requests
    // is useless, so either both rows exist or neither does.
    const { client, admin } = await prisma.$transaction(async (tx) => {
      const client = await tx.client.create({ data: { code: input.code, name: input.name, createdByUserId: actor.userId } });
      const admin = await createAccount(tx, {
        name: input.admin.name,
        email: input.admin.email,
        mobile: input.admin.mobile,
        role: 'CLIENT_ADMIN',
        clientId: client.id,
        passwordHash,
        createdByUserId: actor.userId,
      });
      return { client, admin };
    });
    return { client: toClientDto(client), admin: { id: admin.id, email: admin.email, temporaryPassword } };
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') throw codeConflict();
    throw conflictFromUniqueViolation(error) ?? error;
  }
}

export async function listClients(actor: Actor, query: ListClientsQuery): Promise<Page<ReturnType<typeof toClientDto>>> {
  assertCan('client.manage', actor);

  const where: Prisma.ClientWhereInput = {
    isDeleted: 0,
    ...(query.isActive !== undefined && { isActive: query.isActive ? 1 : 0 }),
    ...(query.search && {
      OR: [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }],
    }),
  };

  const [items, total] = await Promise.all([
    prisma.client.findMany({ where, orderBy: { [query.sort]: query.order }, ...skipTake(query) }),
    prisma.client.count({ where }),
  ]);
  return pageOf(items.map(toClientDto), total, query);
}

export async function getClient(actor: Actor, id: number) {
  assertCan('client.manage', actor);
  return toClientDto(await fetchClient(id));
}

export async function updateClient(actor: Actor, id: number, input: UpdateClientInput) {
  assertCan('client.manage', actor);
  await fetchClient(id);
  return toClientDto(await prisma.client.update({ where: { id }, data: { name: input.name, modifiedByUserId: actor.userId } }));
}

export async function setClientActive(actor: Actor, id: number, active: boolean) {
  assertCan('client.manage', actor);
  await fetchClient(id);
  return toClientDto(await prisma.client.update({ where: { id }, data: { isActive: active ? 1 : 0, modifiedByUserId: actor.userId } }));
}

// A10: needs zero non-deleted Client Users and zero PENDING requests; its
// Client Admins go with it (soft-deleted, same as any other user delete).
export async function deleteClient(actor: Actor, id: number): Promise<void> {
  assertCan('client.manage', actor);
  await fetchClient(id);

  await prisma.$transaction(async (tx) => {
    const activeUsers = await tx.user.count({ where: { clientId: id, roleId: ROLE_IDS.CLIENT_USER, isDeleted: 0 } });
    if (activeUsers > 0) throw new AppError(409, 'CLIENT_HAS_ACTIVE_USERS', 'This client still has active players — remove them first');

    const pendingRequests = await tx.walletRequest.count({ where: { clientId: id, statusId: LOOKUP_IDS.WALLET_REQUEST_STATUS.PENDING } });
    if (pendingRequests > 0) throw new AppError(409, 'CLIENT_HAS_PENDING_REQUESTS', 'This client still has pending fund requests — resolve them first');

    const admins = await tx.user.findMany({ where: { clientId: id, roleId: ROLE_IDS.CLIENT_ADMIN, isDeleted: 0 } });
    for (const admin of admins) {
      await tx.user.update({ where: { id: admin.id }, data: anonymisedAccount(admin.id, actor.userId) });
    }

    await tx.client.update({ where: { id }, data: { isDeleted: 1, isActive: 0, code: `DEL-${id}`, modifiedByUserId: actor.userId } });
  });
}
