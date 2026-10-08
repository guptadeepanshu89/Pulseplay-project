import { Router } from 'express';
import { Prisma } from '@prisma/client';

import { prisma } from '../db';
import { actorOf, AuthedRequest, clientIdOf } from '../core/actor';
import { authenticate } from '../core/middleware/authenticate';
import { requireRole } from '../core/middleware/requireRole';
import { serialize } from '../lib/serialize';
import { calculatePotentialReturn } from '../lib/money';
import { parseId } from '../lib/parseId';
import { asyncHandler } from '../lib/asyncHandler';
import { LOOKUP_IDS } from '../lib/lookupCache';
import { fetchBetsWithSelections } from '../lib/betDto';

const router = Router();
router.use(authenticate(['mobile']), requireRole('CLIENT_USER'));

interface IncomingSelection {
  eventId: number;
  eventName: string;
  marketId: number;
  marketName: string;
  selectionId: number;
  selectionName: string;
}

class InsufficientFundsError extends Error {}
class MarketNotOpenError extends Error {}
class SelectionNotFoundError extends Error {}

router.post(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const { selections, stake } = req.body as { selections?: IncomingSelection[]; stake?: number };
    const actor = actorOf(req);
    const userId = actor.userId;
    // Tenant key for the bet: the bettor's own client.
    const clientId = clientIdOf(actor);

    if (!selections || selections.length === 0 || !stake || stake <= 0) {
      res.status(400).json({ error: 'selections (non-empty) and a positive stake are required' });
      return;
    }

    try {
      const bet = await prisma.$transaction(async (tx) => {
        // Re-read every selection's live price server-side — never trust a client-submitted price.
        const liveSelections = await Promise.all(
          selections.map(async (incoming) => {
            const market = await tx.market.findUnique({ where: { id: incoming.marketId } });
            if (!market) throw new SelectionNotFoundError(`Market ${incoming.marketId} not found`);
            if (market.statusId !== LOOKUP_IDS.MARKET_STATUS.OPEN) throw new MarketNotOpenError(`Market ${incoming.marketId} is not open`);

            const selection = await tx.marketSelection.findUnique({ where: { id: incoming.selectionId } });
            if (!selection || selection.marketId !== incoming.marketId) {
              throw new SelectionNotFoundError(`Selection ${incoming.selectionId} not found on market ${incoming.marketId}`);
            }

            return { incoming, price: selection.currentPrice };
          }),
        );

        const combinedOdds = liveSelections.reduce((product, leg) => product * leg.price.toNumber(), 1);
        const potentialReturn = calculatePotentialReturn(stake, combinedOdds);

        const lockResult = await tx.wallet.updateMany({
          where: { userId, availableBalance: { gte: stake } },
          data: { availableBalance: { decrement: stake }, lockedBalance: { increment: stake } },
        });
        if (lockResult.count !== 1) {
          throw new InsufficientFundsError('Insufficient available balance');
        }

        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId } });
        const afterAvailable = wallet.availableBalance.toNumber();
        const afterLocked = wallet.lockedBalance.toNumber();
        const beforeAvailable = afterAvailable + stake;
        const beforeLocked = afterLocked - stake;

        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            userId,
            typeId: LOOKUP_IDS.WALLET_TRANSACTION_TYPE.BET_LOCK,
            amount: -stake,
            statusId: LOOKUP_IDS.WALLET_TRANSACTION_STATUS.COMPLETED,
            referenceTypeId: LOOKUP_IDS.REFERENCE_TYPE.BET,
          },
        });
        await tx.walletLedger.create({
          data: {
            walletId: wallet.id,
            userId,
            transactionTypeId: LOOKUP_IDS.WALLET_TRANSACTION_TYPE.BET_LOCK,
            amount: -stake,
            beforeAvailable,
            afterAvailable,
            beforeLocked,
            afterLocked,
            referenceTypeId: LOOKUP_IDS.REFERENCE_TYPE.BET,
            statusId: LOOKUP_IDS.WALLET_TRANSACTION_STATUS.COMPLETED,
          },
        });

        const createdBet = await tx.bet.create({
          data: {
            userId,
            clientId,
            stake,
            combinedOdds,
            potentialReturn,
            statusId: LOOKUP_IDS.BET_STATUS.OPEN,
            legCount: liveSelections.length,
            selections: {
              create: liveSelections.map((leg) => ({
                eventId: leg.incoming.eventId,
                eventName: leg.incoming.eventName,
                marketId: leg.incoming.marketId,
                marketName: leg.incoming.marketName,
                selectionId: leg.incoming.selectionId,
                selectionName: leg.incoming.selectionName,
                oddsAtPlacement: leg.price,
              })),
            },
          },
          include: { selections: true },
        });

        await tx.notification.create({
          data: {
            userId,
            typeId: LOOKUP_IDS.NOTIFICATION_TYPE.BET_PLACED,
            title: 'Bet Placed',
            message: `Your bet of ${stake} has been placed.`,
            read: false,
          },
        });

        return createdBet;
      });

      const [betDto] = await fetchBetsWithSelections(prisma, Prisma.sql`WHERE b.id = ${bet.id}`);
      res.status(201).json(serialize(betDto));
    } catch (error) {
      if (error instanceof InsufficientFundsError) {
        res.status(400).json({ error: error.message });
        return;
      }
      if (error instanceof MarketNotOpenError) {
        res.status(409).json({ error: error.message });
        return;
      }
      if (error instanceof SelectionNotFoundError) {
        res.status(404).json({ error: error.message });
        return;
      }
      throw error;
    }
  }),
);

router.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const bets = await fetchBetsWithSelections(prisma, Prisma.sql`WHERE b."userId" = ${actorOf(req).userId}`);
    res.json(serialize(bets));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = parseId(req.params.id);
    if (id === undefined) {
      res.status(400).json({ error: 'Invalid bet id' });
      return;
    }
    const bets = await fetchBetsWithSelections(prisma, Prisma.sql`WHERE b.id = ${id} AND b."userId" = ${actorOf(req).userId}`);
    if (bets.length === 0) {
      res.status(404).json({ error: 'Bet not found' });
      return;
    }
    res.json(serialize(bets[0]));
  }),
);

export default router;
