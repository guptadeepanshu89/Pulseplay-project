import { Prisma } from '@prisma/client';

import { Actor, clientIdOf } from '../../core/actor';
import { AppError } from '../../core/errors';
import { Page, pageOf } from '../../core/pagination';
import { assertCan } from '../../core/policies/assert';
import { clientScope } from '../../core/tenant';
import { prisma } from '../../db';
import { LOOKUP_IDS } from '../../lib/lookupCache';
import { ROLE_IDS } from '../../lib/roleCache';
import { fetchAdminFundRequestById, fetchAdminFundRequestsPage, toFundRequestDto } from './dto';
import { CreateFundRequestInput, ListFundRequestsQuery } from './schemas';

const MAX_PENDING_PER_USER = 5;
// Arbitrary, private to this module: namespaces the advisory lock below so it
// can never collide with a lock some other feature takes by user id.
const PENDING_CAP_LOCK_NAMESPACE = 913_411;

// A1/A8: at most 5 PENDING requests per user. Two requests from the same user
// racing to be the "5th" is closed off with a per-user advisory lock — a plain
// count-then-insert would let both pass the check before either commits.
export async function createFundRequest(actor: Actor, input: CreateFundRequestInput): Promise<number> {
  assertCan('fundRequest.create', actor);
  const clientId = clientIdOf(actor);

  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${PENDING_CAP_LOCK_NAMESPACE}::int, ${actor.userId}::int)`;

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: actor.userId } });
    const pending = await tx.walletRequest.count({
      where: { userId: actor.userId, statusId: LOOKUP_IDS.WALLET_REQUEST_STATUS.PENDING },
    });
    if (pending >= MAX_PENDING_PER_USER) {
      throw new AppError(409, 'TOO_MANY_PENDING', `You already have ${MAX_PENDING_PER_USER} pending requests`);
    }

    const request = await tx.walletRequest.create({
      data: {
        walletId: wallet.id,
        userId: actor.userId,
        clientId, // routing key, from the session — never from the request body
        typeId: LOOKUP_IDS.WALLET_REQUEST_TYPE[input.type],
        amount: input.amount,
        reason: input.reason,
        statusId: LOOKUP_IDS.WALLET_REQUEST_STATUS.PENDING,
      },
    });

    const approvers = await tx.user.findMany({
      where: { clientId, roleId: ROLE_IDS.CLIENT_ADMIN, isActive: 1, isDeleted: 0 },
      select: { id: true },
    });
    if (approvers.length > 0) {
      const verb = input.type === 'INCREASE' ? 'a deposit of' : 'a withdrawal of';
      await tx.notification.createMany({
        data: approvers.map((approver) => ({
          userId: approver.id,
          typeId: LOOKUP_IDS.NOTIFICATION_TYPE.WALLET_REQUEST_RECEIVED,
          title: 'New Fund Request',
          message: `A player has requested ${verb} ${input.amount}.`,
          read: false,
        })),
      });
    }

    return request.id;
  });
}

export async function listFundRequests(actor: Actor, query: ListFundRequestsQuery): Promise<Page<ReturnType<typeof toFundRequestDto>>> {
  assertCan('fundRequest.list', actor);
  const scope = clientScope(actor, query.clientId);

  const conditions: Prisma.Sql[] = [];
  if (scope !== undefined) conditions.push(Prisma.sql`wr."clientId" = ${scope}`);
  if (query.status) conditions.push(Prisma.sql`wr."statusCode" = ${query.status}`);
  if (query.userId !== undefined) conditions.push(Prisma.sql`wr."userId" = ${query.userId}`);
  const whereSql = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.sql``;

  const { rows, total } = await fetchAdminFundRequestsPage(prisma, whereSql, query.pageSize, (query.page - 1) * query.pageSize);
  return pageOf(rows, total, query);
}

// The one tenant-safe way to load a request for approve/reject: a foreign
// client's request looks exactly like a non-existent one (never a 403 that
// would confirm it exists).
async function fetchScoped(actor: Actor, id: number) {
  const row = await fetchAdminFundRequestById(prisma, id);
  const scope = clientScope(actor, undefined);
  if (!row || (scope !== undefined && row.clientId !== scope)) throw new AppError(404, 'NOT_FOUND', 'Wallet request not found');
  return row;
}

export async function resolveFundRequest(actor: Actor, id: number, decision: 'APPROVE' | 'REJECT') {
  const existing = await fetchScoped(actor, id);
  assertCan('fundRequest.resolve', actor, { clientId: existing.clientId });

  const targetStatusId = decision === 'APPROVE' ? LOOKUP_IDS.WALLET_REQUEST_STATUS.APPROVED : LOOKUP_IDS.WALLET_REQUEST_STATUS.REJECTED;

  await prisma.$transaction(async (tx) => {
    // Conditional claim: only one caller can move this request out of PENDING.
    const claim = await tx.walletRequest.updateMany({
      where: { id, statusId: LOOKUP_IDS.WALLET_REQUEST_STATUS.PENDING },
      data: { statusId: targetStatusId, resolvedAt: new Date(), resolvedByUserId: actor.userId },
    });
    if (claim.count !== 1) throw new AppError(409, 'NOT_PENDING', 'This request has already been resolved');

    const request = await tx.walletRequest.findUniqueOrThrow({ where: { id } });
    const requester = await tx.user.findUniqueOrThrow({ where: { id: request.userId } });

    if (decision === 'REJECT') {
      await tx.notification.create({
        data: {
          userId: request.userId,
          typeId: LOOKUP_IDS.NOTIFICATION_TYPE.WALLET_REJECTED,
          title: 'Wallet Request Rejected',
          message: `Your request for ${request.amount} was rejected.`,
          read: false,
        },
      });
      return;
    }

    // The requester may have been blocked/deleted since filing the request. Throwing
    // here rolls back the claim above too, so the request stays PENDING for a retry.
    if (requester.isDeleted === 1 || requester.isActive === 0) {
      throw new AppError(409, 'USER_NOT_ACTIVE', 'This player is no longer active');
    }

    const wallet = await tx.wallet.findUniqueOrThrow({ where: { id: request.walletId } });
    const isIncrease = request.typeId === LOOKUP_IDS.WALLET_REQUEST_TYPE.INCREASE;
    const txnTypeId = isIncrease ? LOOKUP_IDS.WALLET_TRANSACTION_TYPE.ADMIN_CREDIT : LOOKUP_IDS.WALLET_TRANSACTION_TYPE.ADMIN_DEBIT;

    let updatedWallet;
    if (isIncrease) {
      updatedWallet = await tx.wallet.update({ where: { id: wallet.id }, data: { availableBalance: { increment: request.amount } } });
    } else {
      // The known defect this fixes: without this guard a DECREASE could push
      // availableBalance negative. The conditional update is the guard.
      const debit = await tx.wallet.updateMany({
        where: { id: wallet.id, availableBalance: { gte: request.amount } },
        data: { availableBalance: { decrement: request.amount } },
      });
      if (debit.count !== 1) throw new AppError(409, 'INSUFFICIENT_FUNDS', 'The player does not have enough available balance');
      updatedWallet = await tx.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    }

    const delta = isIncrease ? request.amount : request.amount.negated();
    await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        userId: request.userId,
        typeId: txnTypeId,
        amount: delta,
        statusId: LOOKUP_IDS.WALLET_TRANSACTION_STATUS.COMPLETED,
        referenceTypeId: LOOKUP_IDS.REFERENCE_TYPE.WALLET_REQUEST,
        referenceId: String(request.id),
        createdByUserId: actor.userId,
      },
    });
    await tx.walletLedger.create({
      data: {
        walletId: wallet.id,
        userId: request.userId,
        transactionTypeId: txnTypeId,
        amount: delta,
        beforeAvailable: wallet.availableBalance,
        afterAvailable: updatedWallet.availableBalance,
        beforeLocked: wallet.lockedBalance,
        afterLocked: updatedWallet.lockedBalance,
        referenceTypeId: LOOKUP_IDS.REFERENCE_TYPE.WALLET_REQUEST,
        referenceId: String(request.id),
        statusId: LOOKUP_IDS.WALLET_TRANSACTION_STATUS.COMPLETED,
        createdByUserId: actor.userId,
      },
    });
    await tx.notification.create({
      data: {
        userId: request.userId,
        typeId: LOOKUP_IDS.NOTIFICATION_TYPE.WALLET_APPROVED,
        title: 'Wallet Request Approved',
        message: `Your request for ${request.amount} has been approved.`,
        read: false,
      },
    });
  });

  return toFundRequestDto(await fetchAdminFundRequestById(prisma, id));
}
