import { Router } from 'express';
import { Prisma } from '@prisma/client';

import { prisma } from '../db';
import { actorOf, AuthedRequest } from '../core/actor';
import { authenticate } from '../core/middleware/authenticate';
import { requireRole } from '../core/middleware/requireRole';
import { validateBody } from '../core/middleware/validate';
import { serialize } from '../lib/serialize';
import { asyncHandler } from '../lib/asyncHandler';
import { fetchWalletRequests, fetchWalletTransactions } from '../lib/walletDto';
import { createFundRequestSchema } from '../modules/fundRequests/schemas';
import { createFundRequest } from '../modules/fundRequests/service';

const router = Router();
router.use(authenticate(['mobile']), requireRole('CLIENT_USER'));

router.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const wallet = await prisma.wallet.findUnique({ where: { userId: actorOf(req).userId } });
    if (!wallet) {
      res.status(404).json({ error: 'Wallet not found' });
      return;
    }
    res.json(
      serialize({
        availableBalance: wallet.availableBalance,
        lockedBalance: wallet.lockedBalance,
        currency: wallet.currency,
      }),
    );
  }),
);

router.get(
  '/transactions',
  asyncHandler(async (req: AuthedRequest, res) => {
    const transactions = await fetchWalletTransactions(prisma, Prisma.sql`WHERE wt."userId" = ${actorOf(req).userId}`);
    res.json(serialize(transactions));
  }),
);

router.get(
  '/requests',
  asyncHandler(async (req: AuthedRequest, res) => {
    const requests = await fetchWalletRequests(prisma, Prisma.sql`WHERE wr."userId" = ${actorOf(req).userId}`);
    res.json(serialize(requests));
  }),
);

router.post(
  '/requests',
  validateBody(createFundRequestSchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    // Business rules (pending cap, notifying the client's approvers, the
    // insufficient-funds guard on approval) live in modules/fundRequests —
    // shared with the admin side, which resolves what gets created here.
    const requestId = await createFundRequest(actorOf(req), req.body);
    const [requestDto] = await fetchWalletRequests(prisma, Prisma.sql`WHERE wr.id = ${requestId}`);
    res.status(201).json(serialize(requestDto));
  }),
);

export default router;
