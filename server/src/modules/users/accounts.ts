import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';

import { AppError } from '../../core/errors';
import { LOOKUP_IDS } from '../../lib/lookupCache';
import { ROLE_IDS, RoleCode } from '../../lib/roleCache';

// Building blocks shared by the users and clients modules (a Client's first
// admin is created by exactly the same rules as any other account).

export type Tx = Prisma.TransactionClient;

export const WALLET_CURRENCY = 'INR';
// What a soft-deleted account's password hash becomes: not a bcrypt hash, so it can never match.
const UNUSABLE_PASSWORD_HASH = '!deleted';

const newUserCode = () => `ID#${randomBytes(4).toString('hex').toUpperCase()}`;

// email / mobile / userCode are globally unique — even against soft-deleted rows —
// so a deleted account is anonymised (below) to free them for reuse.
export async function assertContactFree(tx: Tx, contact: { email?: string; mobile?: string }, exceptUserId?: number): Promise<void> {
  const or: Prisma.UserWhereInput[] = [];
  if (contact.email !== undefined) or.push({ email: contact.email });
  if (contact.mobile !== undefined) or.push({ mobile: contact.mobile });
  if (or.length === 0) return;

  const clash = await tx.user.findFirst({
    where: { OR: or, ...(exceptUserId !== undefined && { id: { not: exceptUserId } }) },
    select: { email: true },
  });
  if (!clash) return;
  if (clash.email === contact.email) throw new AppError(409, 'EMAIL_TAKEN', 'A user with this email already exists');
  throw new AppError(409, 'MOBILE_TAKEN', 'A user with this mobile number already exists');
}

// Two requests can both pass assertContactFree and then race to insert; the
// database's unique index is the real guard. Report the loser as the same
// specific 409 instead of a generic conflict.
export function conflictFromUniqueViolation(error: unknown): AppError | undefined {
  if ((error as { code?: string }).code !== 'P2002') return undefined;
  const target = String((error as { meta?: { target?: unknown } }).meta?.target ?? '');
  if (target.includes('email')) return new AppError(409, 'EMAIL_TAKEN', 'A user with this email already exists');
  if (target.includes('mobile')) return new AppError(409, 'MOBILE_TAKEN', 'A user with this mobile number already exists');
  return undefined;
}

interface NewAccount {
  name: string;
  email: string;
  mobile: string;
  role: Exclude<RoleCode, 'SUPER_ADMIN'>;
  clientId: number;
  passwordHash: string;
  createdByUserId: number;
}

// Creates the user (with a must-change-password flag) and, for players, their wallet — in the caller's transaction.
export async function createAccount(tx: Tx, account: NewAccount) {
  await assertContactFree(tx, account);

  const user = await tx.user.create({
    data: {
      name: account.name,
      email: account.email,
      mobile: account.mobile,
      userCode: newUserCode(),
      passwordHash: account.passwordHash,
      roleId: ROLE_IDS[account.role],
      clientId: account.clientId,
      mustChangePassword: 1,
      createdByUserId: account.createdByUserId,
    },
  });

  if (account.role === 'CLIENT_USER') {
    await tx.wallet.create({
      data: {
        userId: user.id,
        currency: WALLET_CURRENCY,
        availableBalance: 0,
        lockedBalance: 0,
        statusId: LOOKUP_IDS.WALLET_STATUS.ACTIVE,
      },
    });
  }
  return user;
}

// Soft delete: the row and everything that references it stays (bets, ledger),
// but nothing personal does, the account can no longer sign in, and its
// unique identifiers are free again.
export const anonymisedAccount = (id: number, actorId: number): Prisma.UserUncheckedUpdateInput => ({
  isDeleted: 1,
  isActive: 0,
  name: 'Deleted User',
  email: `deleted+${id}@invalid.local`,
  mobile: `del-${id}`,
  userCode: `DEL-${id}`,
  avatarUrl: null,
  passwordHash: UNUSABLE_PASSWORD_HASH,
  passwordChangedAt: new Date(),
  modifiedByUserId: actorId,
});

// Serialises changes to a client's set of admins (and blocks deleting the client
// underneath them) for the rest of the transaction.
//   'shared'     many can hold it (creating users in the client) but it excludes 'exclusive'
//   'exclusive'  one at a time (changing the admin set, deleting the client)
export async function lockClient(tx: Tx, clientId: number, mode: 'shared' | 'exclusive') {
  type Row = { id: number; isActive: number; isDeleted: number };
  const rows =
    mode === 'shared'
      ? await tx.$queryRaw<Row[]>`SELECT "id", "isActive", "isDeleted" FROM "Client" WHERE "id" = ${clientId} FOR SHARE`
      : await tx.$queryRaw<Row[]>`SELECT "id", "isActive", "isDeleted" FROM "Client" WHERE "id" = ${clientId} FOR UPDATE`;
  return rows[0];
}

// A client must have an active admin to approve fund requests, so the last one
// can be neither blocked nor deleted (the client itself can be deleted instead).
export async function assertNotLastAdmin(tx: Tx, admin: { id: number; clientId: number | null }): Promise<void> {
  if (admin.clientId === null) return;
  await lockClient(tx, admin.clientId, 'exclusive');
  const others = await tx.user.count({
    where: { clientId: admin.clientId, roleId: ROLE_IDS.CLIENT_ADMIN, isDeleted: 0, isActive: 1, id: { not: admin.id } },
  });
  if (others === 0) throw new AppError(409, 'LAST_ADMIN', 'This is the last active admin of the client');
}
