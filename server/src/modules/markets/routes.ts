import { Router } from 'express';

import { actorOf, AuthedRequest } from '../../core/actor';
import { authenticate } from '../../core/middleware/authenticate';
import { requireRole } from '../../core/middleware/requireRole';
import { asyncHandler } from '../../lib/asyncHandler';
import { idParam } from '../../core/ids';
import { resumeMarket, settleMarket, suspendMarket } from './settlement';

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

    res.json(await settleMarket(marketId, winningSelectionId, actorOf(req).userId));
  }),
);

router.post(
  '/:id/suspend',
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await suspendMarket(idParam(req.params.id), actorOf(req).userId));
  }),
);

router.post(
  '/:id/resume',
  asyncHandler(async (req: AuthedRequest, res) => {
    res.json(await resumeMarket(idParam(req.params.id), actorOf(req).userId));
  }),
);

export default router;
