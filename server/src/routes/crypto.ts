import { Router } from 'express';

import { prisma } from '../db';
import { authenticate } from '../core/middleware/authenticate';
import { serialize } from '../lib/serialize';
import { asyncHandler } from '../lib/asyncHandler';
import { getBybitTicker } from '../modules/crypto/bybit.service';
import { readCryptoChangePercent24h } from '../modules/crypto/cryptoEventStore';

const BYBIT_SYMBOL_BY_CHART: Record<string, string> = { BTC: 'BTCUSDT', ETH: 'ETHUSDT', SOL: 'SOLUSDT' };

const router = Router();
router.use(authenticate(['mobile', 'admin']));
router.use((req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    next();
    return;
  }
  res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
});

router.get('/bybit', (_req, res) => {
  res.status(400).json({ error: 'Invalid symbol', code: 'INVALID_SYMBOL' });
});

router.get(
  '/bybit/:symbol',
  asyncHandler(async (req, res) => {
    const data = await getBybitTicker(req.params.symbol);
    res.json({ success: true, data });
  }),
);

// Number.MAX_SAFE_INTEGER here previously overflowed JS Date's valid range
// (±8.64e15ms from epoch), producing an Invalid Date that crashed the whole
// server on any `timeframe=ALL` request. 10 years comfortably covers "all
// data" (PriceHistory is pruned to 30 days anyway) while staying far inside
// the valid range.
const TIMEFRAME_MS: Record<string, number> = {
  '24H': 24 * 60 * 60 * 1000,
  '1W': 7 * 24 * 60 * 60 * 1000,
  '1M': 30 * 24 * 60 * 60 * 1000,
  '1Y': 365 * 24 * 60 * 60 * 1000,
  ALL: 10 * 365 * 24 * 60 * 60 * 1000,
};

// The chart this feeds renders at a few hundred px wide, so there's no visual
// benefit past this many points — and without a cap, the response would keep
// growing forever as PriceHistory accumulates (weeks of 30s-resolution ticks
// is tens of thousands of rows for the wider timeframes). Evenly-spaced
// index sampling keeps the shape of the series intact while capping payload
// size; the true last point is always kept so the chart's right edge lines
// up exactly with `currentPrice`.
const MAX_CHART_POINTS = 120;

function downsample<T>(items: T[], maxPoints: number): T[] {
  if (items.length <= maxPoints) return items;
  const step = items.length / maxPoints;
  const sampled: T[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    sampled.push(items[Math.floor(i * step)]);
  }
  sampled[sampled.length - 1] = items[items.length - 1];
  return sampled;
}

router.get(
  '/:symbol/price-history',
  asyncHandler(async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const timeframe = (req.query.timeframe as string | undefined) ?? '24H';
    const windowMs = TIMEFRAME_MS[timeframe] ?? TIMEFRAME_MS['24H'];
    const since = new Date(Date.now() - windowMs);

    const points = await prisma.priceHistory.findMany({
      where: { symbol, timestamp: { gte: since } },
      orderBy: { timestamp: 'asc' },
    });

    let currentPrice = points.length > 0 ? points[points.length - 1].price.toNumber() : 0;
    const firstPrice = points.length > 0 ? points[0].price.toNumber() : currentPrice;
    let asOf = points.length > 0 ? points[points.length - 1].timestamp.getTime() : null;
    let stale = true;
    let livePrice: number | undefined;

    // For 24H, prefer CoinGecko's own 24h change — it reflects the real market
    // move over the last 24h, not just however much history our own feed has
    // accumulated since it started (which can be much less than 24h). For
    // every other timeframe we don't have an external source, so we compute
    // from our own stored window — the best available, and now computed once
    // here instead of duplicated (and drifting) on every client.
    let changePercent = 0;
    let changeAmount = 0;
    const storedChangePercent24h = timeframe === '24H' ? await readCryptoChangePercent24h(symbol) : null;

    const applyPercent = (percent: number) => {
      changePercent = percent;
      const previousPrice = changePercent === -100 ? currentPrice : currentPrice / (1 + changePercent / 100);
      changeAmount = currentPrice - previousPrice;
    };

    let applied = false;
    if (BYBIT_SYMBOL_BY_CHART[symbol]) {
      try {
        const ticker = await getBybitTicker(BYBIT_SYMBOL_BY_CHART[symbol]);
        const live = Number(ticker.lastPrice);
        if (!Number.isFinite(live) || live <= 0) throw new Error('invalid price');
        currentPrice = live;
        livePrice = live;
        asOf = Date.now();
        stale = false;
        if (timeframe === '24H') {
          const ratio = Number(ticker.price24hPcnt);
          if (Number.isFinite(ratio)) {
            applyPercent(ratio * 100);
            applied = true;
          }
        }
      } catch {
        stale = true;
      }
    }
    if (!applied && timeframe === '24H' && storedChangePercent24h != null) {
      applyPercent(storedChangePercent24h);
      applied = true;
    }
    if (!applied) {
      changePercent = firstPrice === 0 ? 0 : ((currentPrice - firstPrice) / firstPrice) * 100;
      changeAmount = currentPrice - firstPrice;
    }

    const chartPoints = downsample(points, MAX_CHART_POINTS).map((point) => ({
      timestamp: point.timestamp.getTime(),
      price: Number(point.price),
    }));
    if (livePrice != null) {
      const now = Date.now();
      if (chartPoints.length === 0) chartPoints.push({ timestamp: now, price: livePrice });
      else chartPoints[chartPoints.length - 1] = { timestamp: now, price: livePrice };
    }

    res.json(
      serialize({
        points: chartPoints,
        currentPrice,
        changePercent,
        changeAmount,
        stale,
        asOf,
      }),
    );
  }),
);

export default router;
