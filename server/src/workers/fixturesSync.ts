import { prisma } from '../db';
import { LOOKUP_IDS } from '../lib/lookupCache';

const SYNC_INTERVAL_MS = 15 * 60 * 1000;
// TheSportsDB's public free test key — no signup required, documented on thesportsdb.com.
const THESPORTSDB_TEST_KEY = '3';
const FOOTBALL_LEAGUE_ID = '4328'; // English Premier League
// Big Bash League (4461) is TheSportsDB's other free cricket option but is out of season
// (runs Dec-Jan) — CPL is in-season and reliably returns fixtures right now.
const CRICKET_LEAGUE_ID = '5176'; // Caribbean Premier League
const FOOTBALL_LIVE_WINDOW_MS = 3 * 60 * 60 * 1000;
const CRICKET_LIVE_WINDOW_MS = 8 * 60 * 60 * 1000;

interface SportsDbFixture {
  idEvent: string;
  strHomeTeam: string;
  strAwayTeam: string;
  strLeague: string;
  dateEvent: string;
  strTime: string | null;
}

function shortName(name: string): string {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 3);
}

async function fetchFixtures(leagueId: string): Promise<SportsDbFixture[]> {
  const url = `https://www.thesportsdb.com/api/v1/json/${THESPORTSDB_TEST_KEY}/eventsnextleague.php?id=${leagueId}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`TheSportsDB request failed: ${response.status}`);
  }
  const data = (await response.json()) as { events: SportsDbFixture[] | null };
  return data.events ?? [];
}

async function ensureMarket(
  eventId: number,
  category: 'FOOTBALL' | 'CRICKET',
  homeName: string,
  awayName: string,
): Promise<void> {
  const existing = await prisma.market.findFirst({ where: { eventId } });
  if (existing) return;

  const jitter = () => Number((Math.random() * 0.3 - 0.15).toFixed(2));
  const openMarket = LOOKUP_IDS.MARKET_STATUS.OPEN;

  const selections =
    category === 'FOOTBALL'
      ? [
          { code: 'HOME', name: homeName, currentPrice: 1.9 + jitter() },
          { code: 'DRAW', name: 'Draw', currentPrice: 3.4 + jitter() },
          { code: 'AWAY', name: awayName, currentPrice: 2.8 + jitter() },
        ]
      : [
          { code: 'HOME', name: homeName, currentPrice: 1.85 + jitter() },
          { code: 'AWAY', name: awayName, currentPrice: 1.95 + jitter() },
        ];

  await prisma.market.create({
    data: {
      eventId,
      marketType: 'MATCH_WINNER',
      name: 'Match Winner',
      statusId: openMarket,
      selections: {
        create: selections.map((selection, index) => ({ ...selection, priceVersion: 1, statusId: openMarket, sortOrder: index })),
      },
    },
  });
}

async function syncLeague(leagueId: string, category: 'FOOTBALL' | 'CRICKET'): Promise<void> {
  const liveWindowMs = category === 'FOOTBALL' ? FOOTBALL_LIVE_WINDOW_MS : CRICKET_LIVE_WINDOW_MS;
  const fixtures = await fetchFixtures(leagueId);
  const categoryId = LOOKUP_IDS.EVENT_CATEGORY[category];

  for (const fixture of fixtures) {
    if (!fixture.dateEvent || !fixture.strTime || !fixture.strHomeTeam || !fixture.strAwayTeam) continue;

    const kickoff = new Date(`${fixture.dateEvent}T${fixture.strTime}Z`);
    if (Number.isNaN(kickoff.getTime())) continue;

    const now = Date.now();
    const status = now >= kickoff.getTime() + liveWindowMs ? 'COMPLETED' : now >= kickoff.getTime() ? 'LIVE' : 'SCHEDULED';
    const statusId = LOOKUP_IDS.EVENT_STATUS[status];

    const existing = await prisma.event.findUnique({ where: { externalId: fixture.idEvent } });

    if (!existing) {
      const created = await prisma.event.create({
        data: {
          externalId: fixture.idEvent,
          categoryId,
          name: `${fixture.strHomeTeam} vs ${fixture.strAwayTeam}`,
          competition: fixture.strLeague,
          startTime: kickoff,
          statusId,
          homeTeamName: fixture.strHomeTeam,
          homeTeamShort: shortName(fixture.strHomeTeam),
          homeScore: status === 'SCHEDULED' ? null : '0',
          awayTeamName: fixture.strAwayTeam,
          awayTeamShort: shortName(fixture.strAwayTeam),
          awayScore: status === 'SCHEDULED' ? null : '0',
        },
      });
      await ensureMarket(created.id, category, fixture.strHomeTeam, fixture.strAwayTeam);
    } else if (existing.statusId !== statusId) {
      // Only the status transitions here — sportsTicker.ts owns score movement once a
      // fixture goes LIVE, so we never overwrite homeScore/awayScore from this sync.
      await prisma.event.update({ where: { id: existing.id }, data: { statusId } });
    }
  }
}

async function tick(): Promise<void> {
  await syncLeague(FOOTBALL_LEAGUE_ID, 'FOOTBALL');
  await syncLeague(CRICKET_LEAGUE_ID, 'CRICKET');
}

export function startFixturesSync(): void {
  let inFlight = false;

  const run = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      await tick();
    } catch (error) {
      console.error('[fixturesSync] tick failed:', error);
    } finally {
      inFlight = false;
      setTimeout(run, SYNC_INTERVAL_MS);
    }
  };

  run();
}
