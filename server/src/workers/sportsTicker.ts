import { prisma } from '../db';
import { LOOKUP_IDS } from '../lib/lookupCache';
import { emitAll, emitMarket } from '../realtime/hub';
import { noteWorker, safeError, workersAcceptTicks } from '../realtime/runtime';

const TICK_INTERVAL_MS = 5000;
const PRICE_JITTER_RATIO = 0.03;
const MIN_PRICE = 1.01;

function jitterPrice(current: number): number {
  const delta = current * PRICE_JITTER_RATIO * (Math.random() * 2 - 1);
  return Math.max(MIN_PRICE, Number((current + delta).toFixed(2)));
}

export async function runSportsTick(): Promise<void> {
  const cricketCategory = LOOKUP_IDS.EVENT_CATEGORY.CRICKET;
  const footballCategory = LOOKUP_IDS.EVENT_CATEGORY.FOOTBALL;

  let scoresChanged = false;
  const liveEvents = await prisma.event.findMany({
    where: { statusId: LOOKUP_IDS.EVENT_STATUS.LIVE, categoryId: { in: [cricketCategory, footballCategory] } },
    include: { markets: { where: { statusId: LOOKUP_IDS.MARKET_STATUS.OPEN }, include: { selections: true } } },
  });

  for (const event of liveEvents) {
    const nudgeHome = Math.random() < 0.15;
    const nudgeAway = Math.random() < 0.15;

    if (event.categoryId === footballCategory && (nudgeHome || nudgeAway)) {
      await prisma.event.update({
        where: { id: event.id },
        data: {
          homeScore: nudgeHome && event.homeScore ? String(Number(event.homeScore) + 1) : event.homeScore,
          awayScore: nudgeAway && event.awayScore ? String(Number(event.awayScore) + 1) : event.awayScore,
        },
      });
      scoresChanged = true;
    }

    if (event.categoryId === cricketCategory && event.homeScore) {
      const runsDelta = Math.floor(Math.random() * 5);
      await prisma.event.update({
        where: { id: event.id },
        data: { homeScore: String(Number(event.homeScore) + runsDelta) },
      });
      scoresChanged = true;
    }

    for (const market of event.markets) {
      const updated: Array<{ id: number; currentPrice: number; priceVersion: number }> = [];
      for (const selection of market.selections) {
        const currentPrice = jitterPrice(selection.currentPrice.toNumber());
        const row = await prisma.marketSelection.update({
          where: { id: selection.id },
          data: { currentPrice, priceVersion: { increment: 1 } },
        });
        updated.push({ id: row.id, currentPrice: row.currentPrice.toNumber(), priceVersion: row.priceVersion });
      }
      // Synthetic display jitter for demo/live UI only. Settlement never reads these ticks.
      emitMarket(market.id, 'odds.updated', { selections: updated, synthetic: true, settlesBets: false });
    }
  }

  if (scoresChanged) emitAll('events.updated', 0, { synthetic: true, settlesBets: false });
}

export function startSportsTicker(): void {
  let inFlight = false;

  const run = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      await runSportsTick();
      noteWorker('sportsTicker', 'ok');
    } catch (error) {
      noteWorker('sportsTicker', 'error', error);
      console.error('[sportsTicker] tick failed:', safeError(error));
    } finally {
      inFlight = false;
      if (workersAcceptTicks()) setTimeout(run, TICK_INTERVAL_MS);
    }
  };

  setTimeout(run, TICK_INTERVAL_MS);
}
