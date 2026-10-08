import { prisma } from '../db';
import { LOOKUP_IDS } from '../lib/lookupCache';

const TICK_INTERVAL_MS = 5000;
const PRICE_JITTER_RATIO = 0.03;
const MIN_PRICE = 1.01;

function jitterPrice(current: number): number {
  const delta = current * PRICE_JITTER_RATIO * (Math.random() * 2 - 1);
  return Math.max(MIN_PRICE, Number((current + delta).toFixed(2)));
}

async function tick(): Promise<void> {
  const cricketCategory = LOOKUP_IDS.EVENT_CATEGORY.CRICKET;
  const footballCategory = LOOKUP_IDS.EVENT_CATEGORY.FOOTBALL;

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
    }

    if (event.categoryId === cricketCategory && event.homeScore) {
      const runsDelta = Math.floor(Math.random() * 5);
      await prisma.event.update({
        where: { id: event.id },
        data: { homeScore: String(Number(event.homeScore) + runsDelta) },
      });
    }

    for (const market of event.markets) {
      for (const selection of market.selections) {
        await prisma.marketSelection.update({
          where: { id: selection.id },
          data: {
            currentPrice: jitterPrice(selection.currentPrice.toNumber()),
            priceVersion: { increment: 1 },
          },
        });
      }
    }
  }
}

export function startSportsTicker(): void {
  let inFlight = false;

  const run = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      await tick();
    } catch (error) {
      console.error('[sportsTicker] tick failed:', error);
    } finally {
      inFlight = false;
      setTimeout(run, TICK_INTERVAL_MS);
    }
  };

  setTimeout(run, TICK_INTERVAL_MS);
}
