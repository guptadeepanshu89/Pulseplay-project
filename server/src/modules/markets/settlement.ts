import { Prisma } from '@prisma/client';

import { AppError } from '../../core/errors';
import { prisma } from '../../db';
import { fetchBetsWithSelections } from '../../lib/betDto';
import { LOOKUP_IDS } from '../../lib/lookupCache';
import { serialize } from '../../lib/serialize';
import { emitMarket, emitUser } from '../../realtime/hub';

type Tx = Prisma.TransactionClient;

async function lockMarket(tx: Tx, marketId: number) {
  const rows = await tx.$queryRaw<Array<{ id: number; statusId: number }>>`
    SELECT id, "statusId" FROM "Market" WHERE id = ${marketId} FOR UPDATE
  `;
  return rows[0] ?? null;
}

export async function lockMarketsForBet(tx: Tx, marketIds: number[]) {
  const ids = [...new Set(marketIds)].filter((id) => Number.isInteger(id) && id > 0).sort((a, b) => a - b);
  if (ids.length === 0) return [];
  return tx.$queryRaw<Array<{ id: number; statusId: number }>>`
    SELECT id, "statusId" FROM "Market" WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE
  `;
}

function notifyMarketUsers(userIds: number[], marketId: number, type: string, title: string, message: string) {
  for (const userId of userIds) {
    emitUser(userId, type, marketId);
    emitUser(userId, 'notification.created', marketId, { title });
  }
  emitMarket(marketId, type, { title, message });
}

export async function suspendMarket(marketId: number, actorUserId: number) {
  const userIds = await prisma.$transaction(async (tx) => {
    const market = await lockMarket(tx, marketId);
    if (!market) throw new AppError(404, 'NOT_FOUND', 'Market not found');
    if (market.statusId !== LOOKUP_IDS.MARKET_STATUS.OPEN) {
      throw new AppError(409, 'NOT_OPEN', 'Only an open market can be suspended');
    }
    await tx.market.update({
      where: { id: marketId },
      data: { statusId: LOOKUP_IDS.MARKET_STATUS.SUSPENDED, modifiedByUserId: actorUserId },
    });
    const bets = await tx.bet.findMany({
      where: { statusId: LOOKUP_IDS.BET_STATUS.OPEN, selections: { some: { marketId } } },
      select: { userId: true },
    });
    const ids = [...new Set(bets.map((bet) => bet.userId))];
    if (ids.length > 0) {
      await tx.notification.createMany({
        data: ids.map((userId) => ({
          userId,
          typeId: LOOKUP_IDS.NOTIFICATION_TYPE.MARKET_SUSPENDED,
          title: 'Market suspended',
          message: 'Betting is paused on a market in your open bet.',
          read: false,
        })),
      });
    }
    return ids;
  });
  notifyMarketUsers(userIds, marketId, 'market.suspended', 'Market suspended', 'Betting is paused');
  return { marketId, status: 'SUSPENDED' };
}

export async function resumeMarket(marketId: number, actorUserId: number) {
  const userIds = await prisma.$transaction(async (tx) => {
    const market = await lockMarket(tx, marketId);
    if (!market) throw new AppError(404, 'NOT_FOUND', 'Market not found');
    if (market.statusId === LOOKUP_IDS.MARKET_STATUS.SETTLED || market.statusId === LOOKUP_IDS.MARKET_STATUS.CLOSED) {
      throw new AppError(409, 'NOT_RESUMABLE', 'A settled or closed market cannot be resumed');
    }
    if (market.statusId !== LOOKUP_IDS.MARKET_STATUS.SUSPENDED) {
      throw new AppError(409, 'NOT_SUSPENDED', 'Only a suspended market can be resumed');
    }
    await tx.market.update({
      where: { id: marketId },
      data: { statusId: LOOKUP_IDS.MARKET_STATUS.OPEN, modifiedByUserId: actorUserId },
    });
    const bets = await tx.bet.findMany({
      where: { statusId: LOOKUP_IDS.BET_STATUS.OPEN, selections: { some: { marketId } } },
      select: { userId: true },
    });
    const ids = [...new Set(bets.map((bet) => bet.userId))];
    if (ids.length > 0) {
      await tx.notification.createMany({
        data: ids.map((userId) => ({
          userId,
          typeId: LOOKUP_IDS.NOTIFICATION_TYPE.MARKET_RESUMED,
          title: 'Market resumed',
          message: 'Betting has resumed on a market in your open bet.',
          read: false,
        })),
      });
    }
    return ids;
  });
  notifyMarketUsers(userIds, marketId, 'market.resumed', 'Market resumed', 'Betting has resumed');
  return { marketId, status: 'OPEN' };
}

export async function settleMarket(marketId: number, winningSelectionId: number, actorUserId: number) {
  const result = await prisma.$transaction(
    async (tx) => {
      const market = await lockMarket(tx, marketId);
      if (!market) throw new AppError(404, 'NOT_FOUND', 'Market not found');
      if (market.statusId !== LOOKUP_IDS.MARKET_STATUS.OPEN) {
        throw new AppError(409, 'NOT_OPEN', 'Market is not open (already settled, suspended, or closed)');
      }

      const winningSelection = await tx.marketSelection.findUnique({ where: { id: winningSelectionId } });
      if (!winningSelection || winningSelection.marketId !== marketId || winningSelection.isDeleted === 1) {
        throw new AppError(404, 'SELECTION_NOT_FOUND', 'Selection not found on this market');
      }

      await tx.market.update({
        where: { id: marketId },
        data: { statusId: LOOKUP_IDS.MARKET_STATUS.SETTLED, winningSelectionId, modifiedByUserId: actorUserId },
      });
      await tx.marketSelection.updateMany({
        where: { marketId },
        data: { statusId: LOOKUP_IDS.MARKET_STATUS.SETTLED, modifiedByUserId: actorUserId },
      });

      const lockedBets = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT b.id
        FROM "Bet" b
        WHERE b."statusId" = ${LOOKUP_IDS.BET_STATUS.OPEN}
          AND EXISTS (
            SELECT 1 FROM "BetSelectionLeg" l WHERE l."betId" = b.id AND l."marketId" = ${marketId}
          )
        ORDER BY b.id
        FOR UPDATE
      `;
      const betIds = lockedBets.map((row) => row.id);
      const bets =
        betIds.length === 0
          ? []
          : await tx.bet.findMany({ where: { id: { in: betIds } }, include: { selections: true }, orderBy: { id: 'asc' } });

      const otherMarketIds = [
        ...new Set(bets.flatMap((bet) => bet.selections.map((leg) => leg.marketId)).filter((id) => id !== marketId)),
      ];
      const otherMarkets =
        otherMarketIds.length > 0
          ? await tx.market.findMany({
              where: { id: { in: otherMarketIds } },
              select: { id: true, statusId: true, winningSelectionId: true },
            })
          : [];
      const marketById = new Map(otherMarkets.map((row) => [row.id, row]));
      marketById.set(marketId, { id: marketId, statusId: LOOKUP_IDS.MARKET_STATUS.SETTLED, winningSelectionId });

      const settledBetIds: number[] = [];
      const affectedUserIds = new Set<number>();
      let pendingAccumulatorCount = 0;

      for (const bet of bets) {
        let anyLost = false;
        let anyPending = false;
        for (const leg of bet.selections) {
          const legMarket = marketById.get(leg.marketId);
          if (!legMarket || legMarket.statusId !== LOOKUP_IDS.MARKET_STATUS.SETTLED || legMarket.winningSelectionId == null) {
            anyPending = true;
            continue;
          }
          if (leg.selectionId !== legMarket.winningSelectionId) anyLost = true;
        }
        if (anyPending && !anyLost) {
          pendingAccumulatorCount += 1;
          continue;
        }

        const won = !anyLost;
        const claimed = await tx.bet.updateMany({
          where: { id: bet.id, statusId: LOOKUP_IDS.BET_STATUS.OPEN },
          data: { statusId: won ? LOOKUP_IDS.BET_STATUS.WON : LOOKUP_IDS.BET_STATUS.LOST, settledAt: new Date() },
        });
        if (claimed.count !== 1) continue;

        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: bet.userId } });
        const stake = bet.stake.toNumber();
        if (wallet.lockedBalance.toNumber() < stake) {
          throw new AppError(409, 'WALLET_INCONSISTENT', 'Locked balance is below the stake for an open bet');
        }
        const creditAmount = won ? bet.potentialReturn.toNumber() : 0;
        const updatedWallet = await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            lockedBalance: { decrement: stake },
            ...(creditAmount > 0 ? { availableBalance: { increment: creditAmount } } : {}),
          },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId: bet.userId,
            typeId: LOOKUP_IDS.WALLET_TRANSACTION_TYPE.BET_SETTLEMENT,
            amount: creditAmount,
            statusId: LOOKUP_IDS.WALLET_TRANSACTION_STATUS.COMPLETED,
            referenceTypeId: LOOKUP_IDS.REFERENCE_TYPE.BET,
            referenceId: String(bet.id),
          },
        });
        await tx.walletLedger.create({
          data: {
            walletId: wallet.id,
            userId: bet.userId,
            transactionTypeId: LOOKUP_IDS.WALLET_TRANSACTION_TYPE.BET_SETTLEMENT,
            amount: creditAmount,
            beforeAvailable: wallet.availableBalance,
            afterAvailable: updatedWallet.availableBalance,
            beforeLocked: wallet.lockedBalance,
            afterLocked: updatedWallet.lockedBalance,
            referenceTypeId: LOOKUP_IDS.REFERENCE_TYPE.BET,
            referenceId: String(bet.id),
            statusId: LOOKUP_IDS.WALLET_TRANSACTION_STATUS.COMPLETED,
          },
        });
        await tx.notification.create({
          data: {
            userId: bet.userId,
            typeId: LOOKUP_IDS.NOTIFICATION_TYPE.BET_SETTLED,
            title: won ? 'Bet Won!' : 'Bet Settled',
            message: won ? `Your bet won! ${creditAmount} has been credited to your wallet.` : 'Your bet was not successful.',
            read: false,
          },
        });
        settledBetIds.push(bet.id);
        affectedUserIds.add(bet.userId);
      }

      return { settledBetIds, pendingAccumulatorCount, affectedUserIds: [...affectedUserIds] };
    },
    { timeout: 20_000 },
  );

  const settledBets =
    result.settledBetIds.length > 0
      ? await fetchBetsWithSelections(prisma, Prisma.sql`WHERE b.id IN (${Prisma.join(result.settledBetIds)})`)
      : [];

  emitMarket(marketId, 'market.settled', { winningSelectionId });
  for (const userId of result.affectedUserIds) {
    emitUser(userId, 'bet.settled', marketId);
    emitUser(userId, 'wallet.updated', marketId);
    emitUser(userId, 'notification.created', marketId);
  }

  return serialize({ marketId, winningSelectionId, settledBets, pendingAccumulatorCount: result.pendingAccumulatorCount });
}
