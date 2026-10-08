import { Router } from 'express';

import { actorOf, AuthedRequest } from '../../core/actor';
import { idParam } from '../../core/ids';
import { authenticate } from '../../core/middleware/authenticate';
import { requireRole } from '../../core/middleware/requireRole';
import { parseWith, validateBody } from '../../core/middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import { serialize } from '../../lib/serialize';
import { noBodySchema } from '../users/schemas';
import { listFundRequestsQueryFor } from './schemas';
import { listFundRequests, resolveFundRequest } from './service';

const router = Router();
router.use(authenticate(['admin']), requireRole('SUPER_ADMIN', 'CLIENT_ADMIN'));

router.get(
  '/',
  asyncHandler(async (req: AuthedRequest, res) => {
    const actor = actorOf(req);
    res.json(serialize(await listFundRequests(actor, parseWith(listFundRequestsQueryFor(actor), req.query))));
  }),
);

router.post(
  '/:id/approve',
  validateBody(noBodySchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(serialize(await resolveFundRequest(actorOf(req), idParam(req.params.id), 'APPROVE')));
  }),
);

router.post(
  '/:id/reject',
  validateBody(noBodySchema),
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(serialize(await resolveFundRequest(actorOf(req), idParam(req.params.id), 'REJECT')));
  }),
);

export default router;
