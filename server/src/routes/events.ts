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

interface VwEventRow {
  id: number;
  categoryCode: string;
  name: string;
  competition: string;
  startTime: Date;
  statusCode: string;
  scoreLabel: string | null;
  minuteLabel: string | null;
  homeTeamName: string | null;
  homeTeamShort: string | null;
  homeScore: string | null;
  awayTeamName: string | null;
  awayTeamShort: string | null;
  awayScore: string | null;
  symbol: string | null;
}

function coerceScore(score: string | null): number | string | undefined {
  if (score === null) return undefined;
  return /^-?\d+(\.\d+)?$/.test(score) ? Number(score) : score;
}

function toEventDto(row: VwEventRow) {
  return {
    id: row.id,
    category: row.categoryCode,
    name: row.name,
    competition: row.competition,
    startTime: row.startTime.toISOString(),
    status: row.statusCode,
    scoreLabel: row.scoreLabel ?? undefined,
    minuteLabel: row.minuteLabel ?? undefined,
    homeTeam: row.homeTeamName
      ? { name: row.homeTeamName, shortName: row.homeTeamShort ?? row.homeTeamName, score: coerceScore(row.homeScore) }
      : undefined,
    awayTeam: row.awayTeamName
      ? { name: row.awayTeamName, shortName: row.awayTeamShort ?? row.awayTeamName, score: coerceScore(row.awayScore) }
      : undefined,
    symbol: row.symbol ?? undefined,
  };
}

const EVENT_COLUMNS = Prisma.sql`id, "categoryCode", name, competition, "startTime", "statusCode", "scoreLabel", "minuteLabel", "homeTeamName", "homeTeamShort", "homeScore", "awayTeamName", "awayTeamShort", "awayScore", symbol`;

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { category, live } = req.query as { category?: string; live?: string };
    const conditions: Prisma.Sql[] = [];
    if (category) conditions.push(Prisma.sql`e."categoryCode" = ${category}`);
    if (live === 'true') conditions.push(Prisma.sql`e."statusCode" = 'LIVE'`);
    const whereSql = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.sql``;

    const events = await prisma.$queryRaw<VwEventRow[]>(
      Prisma.sql`SELECT ${EVENT_COLUMNS} FROM vw_events e ${whereSql} ORDER BY "startTime" ASC`,
    );
    res.json(serialize(events.map(toEventDto)));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (id === undefined) {
      res.status(400).json({ error: 'Invalid event id' });
      return;
    }
    const events = await prisma.$queryRaw<VwEventRow[]>(
      Prisma.sql`SELECT ${EVENT_COLUMNS} FROM vw_events e WHERE e.id = ${id}`,
    );
    if (events.length === 0) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json(serialize(toEventDto(events[0])));
  }),
);

router.get(
  '/:eventId/markets',
  asyncHandler(async (req, res) => {
    const eventId = parseId(req.params.eventId);
    if (eventId === undefined) {
      res.status(400).json({ error: 'Invalid event id' });
      return;
    }
    const markets = await fetchMarketsWithSelections(prisma, Prisma.sql`WHERE m."eventId" = ${eventId}`);
    res.json(serialize(markets));
  }),
);

export default router;
