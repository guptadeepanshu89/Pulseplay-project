import { Router } from 'express';
import { Prisma } from '@prisma/client';

import { prisma } from '../db';
import { authenticate } from '../core/middleware/authenticate';
import { serialize } from '../lib/serialize';
import { parseId } from '../lib/parseId';
import { asyncHandler } from '../lib/asyncHandler';
import { fetchMarketsWithSelections } from '../lib/marketDto';

const router = Router();
router.use(authenticate(['mobile', 'admin']));

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const markets = await fetchMarketsWithSelections(prisma, Prisma.sql``);
    res.json(serialize(markets));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === undefined) {
      res.status(400).json({ error: 'Invalid market id' });
      return;
    }
    const markets = await fetchMarketsWithSelections(prisma, Prisma.sql`WHERE m.id = ${id}`);
    if (markets.length === 0) {
      res.status(404).json({ error: 'Market not found' });
      return;
    }
    res.json(serialize(markets[0]));
  }),
);

export default router;
