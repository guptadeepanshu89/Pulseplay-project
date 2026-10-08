import { Router } from 'express';
import { z } from 'zod';

import { actorOf, AuthedRequest } from '../../core/actor';
import { authenticate } from '../../core/middleware/authenticate';
import { requireRole } from '../../core/middleware/requireRole';
import { parseWith } from '../../core/middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import { serialize } from '../../lib/serialize';
import { getDashboard } from './service';

const router = Router();
router.use(authenticate(['admin']), requireRole('SUPER_ADMIN', 'CLIENT_ADMIN'));

const superAdminQuery = z.strictObject({ clientId: z.coerce.number().int().positive().optional() });
const clientAdminQuery = z.strictObject({});

router.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const actor = actorOf(req);
    const { clientId } = parseWith(actor.role === 'SUPER_ADMIN' ? superAdminQuery : clientAdminQuery, req.query) as { clientId?: number };
    res.json(serialize(await getDashboard(actor, clientId)));
  }),
);

export default router;
