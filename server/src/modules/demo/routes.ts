import { Router } from 'express';
import { z } from 'zod';

import { actorOf, AuthedRequest } from '../../core/actor';
import { authenticate } from '../../core/middleware/authenticate';
import { validateBody } from '../../core/middleware/validate';
import { asyncHandler } from '../../lib/asyncHandler';
import { emitUser } from '../../realtime/hub';
import { demoSnapshot, tickDemo } from './state';

const emptyBody = z.strictObject({});

const router = Router();
const authed = authenticate(['mobile', 'admin']);

router.get('/snapshot', authed, asyncHandler(async (req, res) => {
  const actor = actorOf(req as AuthedRequest);
  res.json(demoSnapshot(actor.userId));
}));

router.post('/tick', authed, validateBody(emptyBody), asyncHandler(async (req, res) => {
  const actor = actorOf(req as AuthedRequest);
  const snapshot = tickDemo(actor.userId);
  emitUser(actor.userId, 'demo.updated', 0, {
    demo: true,
    synthetic: true,
    settlesBets: false,
    version: snapshot.version,
    price: snapshot.price,
    updatedAt: snapshot.updatedAt,
  });
  res.json(snapshot);
}));

export default router;
