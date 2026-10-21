import { Router } from 'express';

import { authenticate } from '../../core/middleware/authenticate';
import { asyncHandler } from '../../lib/asyncHandler';
import { getCommentary, getLiveMatches, getScore, getScorecard } from './provider';
import { bowlNext, getSimulatorMatch, resetSimulator } from './simulator';

const router = Router();
router.use(authenticate(['mobile', 'admin']));

router.get(
  '/live',
  asyncHandler(async (_req, res) => {
    res.json(await getLiveMatches());
  }),
);

router.get(
  '/test/match',
  asyncHandler(async (_req, res) => {
    res.json(getSimulatorMatch());
  }),
);

router.post(
  '/test/next-ball',
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as { kind?: string; runs?: number; random?: boolean };
    res.json(bowlNext(body));
  }),
);

router.post(
  '/test/reset',
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as { maxOvers?: number; maxWickets?: number; seed?: number };
    res.json(resetSimulator(body));
  }),
);

router.get(
  '/:matchId/commentary',
  asyncHandler(async (req, res) => {
    res.json(await getCommentary(req.params.matchId));
  }),
);

router.get(
  '/:matchId/scorecard',
  asyncHandler(async (req, res) => {
    res.json(await getScorecard(req.params.matchId));
  }),
);

router.get(
  '/:matchId/score',
  asyncHandler(async (req, res) => {
    res.json(await getScore(req.params.matchId));
  }),
);

export default router;
