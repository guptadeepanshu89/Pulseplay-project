import { Prisma } from '@prisma/client';
import { Router } from 'express';
import { z } from 'zod';

import { actorOf, AuthedRequest } from '../../core/actor';
import { authenticate } from '../../core/middleware/authenticate';
import { requireRole } from '../../core/middleware/requireRole';
import { assertCan } from '../../core/policies/assert';
import { clientScope } from '../../core/tenant';
import { parseWith } from '../../core/middleware/validate';
import { prisma } from '../../db';
import { asyncHandler } from '../../lib/asyncHandler';
import { fetchBetsWithSelections } from '../../lib/betDto';
import { serialize } from '../../lib/serialize';

const router = Router();
// Admin-side bet reporting: SA sees any client (optionally filtered), CA sees only their own.
router.use(authenticate(['admin']), requireRole('SUPER_ADMIN', 'CLIENT_ADMIN'));

const superAdminQuery = z.strictObject({ clientId: z.coerce.number().int().positive().optional() });
const clientAdminQuery = z.strictObject({});

router.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const actor = actorOf(req);
    assertCan('bets.viewAny', actor);
    const { clientId } = parseWith(actor.role === 'SUPER_ADMIN' ? superAdminQuery : clientAdminQuery, req.query) as { clientId?: number };
    const scope = clientScope(actor, clientId);
    const whereSql = scope === undefined ? Prisma.sql`` : Prisma.sql`WHERE b."clientId" = ${scope}`;
    res.json(serialize(await fetchBetsWithSelections(prisma, whereSql)));
  }),
);

export default router;
