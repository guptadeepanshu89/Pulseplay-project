import { prisma } from '../db';
import { LOOKUP_IDS } from '../lib/lookupCache';

const TICK_INTERVAL_MS = 30000;
const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true';
const PRICE_JITTER_RATIO = 0.02;
const MIN_ODDS_PRICE = 1.01;
// PriceHistory is an append-only log fed every tick — without pruning it grows forever.
// 30 days comfortably covers every chart timeframe the app offers (24H/1W/1M) with room
// to spare; older rows aren't shown by any screen, so there's no reason to keep them.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const SYMBOL_BY_COINGECKO_ID: Record<string, string> = { bitcoin: 'BTC', ethereum: 'ETH' };

function jitterOdds(current: number): number {
  const delta = current * PRICE_JITTER_RATIO * (Math.random() * 2 - 1);
  return Math.max(MIN_ODDS_PRICE, Number((current + delta).toFixed(2)));
}

async function tick(): Promise<void> {
  const response = await fetch(COINGECKO_URL);
  if (!response.ok) {
    throw new Error(`CoinGecko request failed: ${response.status}`);
  }
  const data = (await response.json()) as Record<string, { usd: number; usd_24h_change?: number }>;
  const now = new Date();

  for (const [coingeckoId, symbol] of Object.entries(SYMBOL_BY_COINGECKO_ID)) {
    const price = data[coingeckoId]?.usd;
    if (typeof price !== 'number') continue;
    const changePercent24h = data[coingeckoId]?.usd_24h_change;

    // CoinGecko's free tier refreshes noticeably slower than our 30s poll
    // interval, so most ticks return the exact same price as last time —
    // writing one anyway just bloats PriceHistory with duplicate rows that
    // add no information. Only append when the price actually moved.
    const lastPoint = await prisma.priceHistory.findFirst({ where: { symbol }, orderBy: { timestamp: 'desc' } });
    if (!lastPoint || !lastPoint.price.equals(price)) {
      await prisma.priceHistory.create({ data: { symbol, timestamp: now, price } });
    }

    const event = await prisma.event.findFirst({
      where: { categoryId: LOOKUP_IDS.EVENT_CATEGORY.CRYPTO, symbol },
      include: { markets: { where: { statusId: LOOKUP_IDS.MARKET_STATUS.OPEN }, include: { selections: true } } },
    });
    if (!event) continue;

    if (typeof changePercent24h === 'number') {
      await prisma.event.update({ where: { id: event.id }, data: { changePercent24h } });
    }

    for (const market of event.markets) {
      for (const selection of market.selections) {
        await prisma.marketSelection.update({
          where: { id: selection.id },
          data: {
            currentPrice: jitterOdds(selection.currentPrice.toNumber()),
            priceVersion: { increment: 1 },
          },
        });
      }
    }
  }

  await prisma.priceHistory.deleteMany({ where: { timestamp: { lt: new Date(Date.now() - RETENTION_MS) } } });
}

export function startCryptoFeed(): void {
  let inFlight = false;

  const run = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      await tick();
    } catch (error) {
      console.error('[cryptoFeed] tick failed:', error);
    } finally {
      inFlight = false;
      setTimeout(run, TICK_INTERVAL_MS);
    }
  };

  // Fire once immediately so PriceHistory has data as soon as the server boots,
  // instead of waiting a full interval before the first real point exists.
  run();
}
