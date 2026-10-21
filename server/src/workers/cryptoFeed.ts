import { prisma } from '../db';
import { LOOKUP_IDS } from '../lib/lookupCache';
import { getBybitTicker } from '../modules/crypto/bybit.service';
import { emitAll } from '../realtime/hub';
import { noteProvider, noteWorker, safeError, workersAcceptTicks } from '../realtime/runtime';

// Crypto symbols are not numeric market ids. The shared socket envelope still
// requires a number, so these stable ids identify the pair while `data.symbol`
// carries the Bybit pair the client matches on.
const CRYPTO_ENTITY_ID: Record<string, number> = { BTCUSDT: 1, ETHUSDT: 2, SOLUSDT: 3 };

const TICK_INTERVAL_MS = 30000;
const FETCH_TIMEOUT_MS = 10000;
const COINGECKO_URL =
  process.env.COINGECKO_API_URL ??
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true';
// PriceHistory is an append-only log fed every tick — without pruning it grows forever.
// 30 days comfortably covers every chart timeframe the app offers (24H/1W/1M) with room
// to spare; older rows aren't shown by any screen, so there's no reason to keep them.
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const SYMBOL_BY_COINGECKO_ID: Record<string, string> = { bitcoin: 'BTC', ethereum: 'ETH' };
const BYBIT_SYMBOLS: { symbol: string; bybit: string }[] = [
  { symbol: 'BTC', bybit: 'BTCUSDT' },
  { symbol: 'ETH', bybit: 'ETHUSDT' },
  { symbol: 'SOL', bybit: 'SOLUSDT' },
];

interface SpotQuote {
  symbol: string;
  marketSymbol: string;
  price: number;
  changePercent24h?: number;
  provider: 'bybit' | 'coingecko';
}

async function quotesFromBybit(): Promise<SpotQuote[]> {
  const quotes: SpotQuote[] = [];
  for (const item of BYBIT_SYMBOLS) {
    try {
      const ticker = await getBybitTicker(item.bybit);
      const price = Number(ticker.lastPrice);
      if (!Number.isFinite(price)) continue;
      const changeRatio = Number(ticker.price24hPcnt);
      quotes.push({
        symbol: item.symbol,
        marketSymbol: item.bybit,
        price,
        changePercent24h: Number.isFinite(changeRatio) ? changeRatio * 100 : undefined,
        provider: 'bybit',
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`[cryptoFeed] Bybit ${item.bybit} unavailable (${reason})`);
    }
  }
  return quotes;
}

async function quotesFromCoinGecko(missing: Set<string>): Promise<SpotQuote[]> {
  if (missing.size === 0) return [];
  let response: Response;
  try {
    response = await fetch(COINGECKO_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[cryptoFeed] CoinGecko unreachable (${reason}) — keeping last cached prices`);
    return [];
  }
  if (!response.ok) {
    console.warn(`[cryptoFeed] CoinGecko HTTP ${response.status} — keeping last cached prices`);
    return [];
  }
  const data = (await response.json()) as Record<string, { usd: number; usd_24h_change?: number }>;
  const quotes: SpotQuote[] = [];
  for (const [coingeckoId, symbol] of Object.entries(SYMBOL_BY_COINGECKO_ID)) {
    if (!missing.has(symbol)) continue;
    const price = data[coingeckoId]?.usd;
    if (typeof price !== 'number') continue;
    if (!Number.isFinite(price) || price <= 0) continue;
    quotes.push({
      symbol,
      marketSymbol: `${symbol}USDT`,
      price,
      changePercent24h: data[coingeckoId]?.usd_24h_change,
      provider: 'coingecko',
    });
  }
  return quotes;
}

export async function runCryptoTick(): Promise<void> {
  const quotes = await quotesFromBybit();
  const have = new Set(quotes.map((quote) => quote.symbol));
  const missing = new Set(Object.values(SYMBOL_BY_COINGECKO_ID).filter((symbol) => !have.has(symbol)));
  quotes.push(...(await quotesFromCoinGecko(missing)));
  if (quotes.length === 0) {
    noteProvider('crypto', 'error', new Error('no verified quotes'));
    return;
  }
  noteProvider('crypto', 'ok');

  const now = new Date();

  for (const quote of quotes) {
    const { symbol, price, changePercent24h } = quote;

    // CoinGecko's free tier refreshes noticeably slower than our 30s poll
    // interval, so most ticks return the exact same price as last time —
    // writing one anyway just bloats PriceHistory with duplicate rows that
    // add no information. Only append when the price actually moved.
    const lastPoint = await prisma.priceHistory.findFirst({ where: { symbol }, orderBy: { timestamp: 'desc' } });
    const changed = !lastPoint || !lastPoint.price.equals(price);
    if (changed) {
      await prisma.priceHistory.create({ data: { symbol, timestamp: now, price } });
      publishCrypto(quote, now);
    }

    // Spot quotes update the chart and the 24h change only. Betting odds are a
    // separate price, and this tick must not reopen or rewrite a suspended,
    // closed, or settled market.
    const event = await prisma.event.findFirst({
      where: { categoryId: LOOKUP_IDS.EVENT_CATEGORY.CRYPTO, symbol },
    });
    if (!event || typeof changePercent24h !== 'number') continue;

    await prisma.event.update({ where: { id: event.id }, data: { changePercent24h } });
  }

  await prisma.priceHistory.deleteMany({ where: { timestamp: { lt: new Date(Date.now() - RETENTION_MS) } } });
}

function publishCrypto(quote: SpotQuote, asOf: Date): void {
  const entityId = CRYPTO_ENTITY_ID[quote.marketSymbol];
  if (!entityId || !Number.isFinite(quote.price) || quote.price <= 0) return;
  try {
    emitAll('crypto.updated', entityId, {
      symbol: quote.marketSymbol,
      price: quote.price,
      provider: quote.provider,
      asOf: asOf.toISOString(),
    });
  } catch (error) {
    console.warn(`[cryptoFeed] socket emit skipped for ${quote.marketSymbol}: ${safeError(error)}`);
  }
}

export function startCryptoFeed(): void {
  let inFlight = false;

  const run = async () => {
    if (inFlight) return;
    inFlight = true;
    try {
      await runCryptoTick();
      noteWorker('cryptoFeed', 'ok');
    } catch (error) {
      noteWorker('cryptoFeed', 'error', error);
      noteProvider('crypto', 'error', error);
      console.warn('[cryptoFeed] tick failed — keeping last cached prices:', safeError(error));
    } finally {
      inFlight = false;
      if (workersAcceptTicks()) setTimeout(run, TICK_INTERVAL_MS);
    }
  };

  // Fire once immediately so PriceHistory has data as soon as the server boots,
  // instead of waiting a full interval before the first real point exists.
  run();
}
