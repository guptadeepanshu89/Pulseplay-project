import { Prisma } from '@prisma/client';
import { Router } from 'express';

import { actorOf, AuthedRequest } from '../../core/actor';
import { authenticate } from '../../core/middleware/authenticate';
import { requireRole } from '../../core/middleware/requireRole';
import { asyncHandler } from '../../lib/asyncHandler';
import { fetchBetsWithSelections } from '../../lib/betDto';
import { idParam } from '../../core/ids';
import { LOOKUP_IDS } from '../../lib/lookupCache';
import { prisma } from '../../db';
import { serialize } from '../../lib/serialize';

const router = Router();
// Markets/events are global and settled only by SuperAdmin (plan D5) — settling
// one market pays out every client's bets on it in the same pass, so there is
// no tenant to scope this to.
router.use(authenticate(['admin']), requireRole('SUPER_ADMIN'));

router.post(
  '/:id/settle',
  asyncHandler(async (req: AuthedRequest, res) => {
    const marketId = idParam(req.params.id);
    const { winningSelectionId } = req.body as { winningSelectionId?: number };
    if (winningSelectionId === undefined) {
      res.status(400).json({ error: 'winningSelectionId is required', code: 'VALIDATION_ERROR' });
      return;
    }

    const winningSelection = await prisma.marketSelection.findUnique({ where: { id: winningSelectionId } });
    if (!winningSelection || winningSelection.marketId !== marketId) {
      res.status(404).json({ error: 'Selection not found on this market', code: 'SELECTION_NOT_FOUND' });
      return;
    }

    // Idempotency guard: only one caller can transition this market out of OPEN.
    const claim = await prisma.market.updateMany({
      where: { id: marketId, statusId: LOOKUP_IDS.MARKET_STATUS.OPEN },
      data: {
        statusId: LOOKUP_IDS.MARKET_STATUS.SETTLED,
        winningSelectionId,
        modifiedByUserId: actorOf(req).userId,
      },
    });
    if (claim.count !== 1) {
      res.status(409).json({ error: 'Market is not open (already settled or does not exist)', code: 'NOT_OPEN' });
      return;
    }

    await prisma.marketSelection.updateMany({
      where: { marketId },
      data: { statusId: LOOKUP_IDS.MARKET_STATUS.SETTLED, modifiedByUserId: actorOf(req).userId },
    });

    // All OPEN bets that include this market — single-leg and multi-leg.
    const bets = await prisma.bet.findMany({
      where: { statusId: LOOKUP_IDS.BET_STATUS.OPEN, selections: { some: { marketId } } },
      include: { selections: true },
    });

    const otherMarketIds = [
      ...new Set(bets.flatMap((bet) => bet.selections.map((leg) => leg.marketId)).filter((id) => id !== marketId)),
    ];
    const otherMarkets =
      otherMarketIds.length > 0
        ? await prisma.market.findMany({
            where: { id: { in: otherMarketIds } },
            select: { id: true, statusId: true, winningSelectionId: true },
          })
        : [];
    const marketById = new Map(otherMarkets.map((m) => [m.id, m]));
    marketById.set(marketId, {
      id: marketId,
      statusId: LOOKUP_IDS.MARKET_STATUS.SETTLED,
      winningSelectionId,
    });

    const settledBetIds: number[] = [];
    let pendingAccumulatorCount = 0;

    for (const bet of bets) {
      let anyLost = false;
      let anyPending = false;

      for (const leg of bet.selections) {
        const market = marketById.get(leg.marketId);
        if (!market || market.statusId !== LOOKUP_IDS.MARKET_STATUS.SETTLED || market.winningSelectionId == null) {
          anyPending = true;
          continue;
        }
        if (leg.selectionId !== market.winningSelectionId) {
          anyLost = true;
        }
      }

      // Accumulator still waiting on other legs — leave OPEN, keep stake locked.
      if (anyPending && !anyLost) {
        pendingAccumulatorCount += 1;
        continue;
      }

      const won = !anyLost;

      let didSettle = false;
      await prisma.$transaction(async (tx) => {
        // Prevent duplicate wallet credit if two settle calls race on the same bet.
        const claimed = await tx.bet.updateMany({
          where: { id: bet.id, statusId: LOOKUP_IDS.BET_STATUS.OPEN },
          data: {
            statusId: won ? LOOKUP_IDS.BET_STATUS.WON : LOOKUP_IDS.BET_STATUS.LOST,
            settledAt: new Date(),
          },
        });
        if (claimed.count !== 1) return;

        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId: bet.userId } });
        const stake = bet.stake.toNumber();
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
            message: won
              ? `Your bet won! ${creditAmount} has been credited to your wallet.`
              : 'Your bet was not successful.',
            read: false,
          },
        });

        didSettle = true;
      });
      if (didSettle) settledBetIds.push(bet.id);
    }

    const settledBets =
      settledBetIds.length > 0 ? await fetchBetsWithSelections(prisma, Prisma.sql`WHERE b.id IN (${Prisma.join(settledBetIds)})`) : [];

    res.json(serialize({ marketId, winningSelectionId, settledBets, pendingAccumulatorCount }));
  }),
);

export default router;
