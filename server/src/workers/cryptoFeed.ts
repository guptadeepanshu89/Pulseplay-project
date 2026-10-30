import { getBybitTicker } from '../modules/crypto/bybit.service';
import { bybitStreamIsFresh } from '../modules/crypto/bybitSpotStream';
import { ingestSpotQuote, prunePriceHistory, type SpotQuote } from '../modules/crypto/cryptoQuotes';
import { noteProvider, noteWorker, safeError, workersAcceptTicks } from '../realtime/runtime';

const TICK_INTERVAL_MS = 30_000;
const FETCH_TIMEOUT_MS = 10_000;
const COINGECKO_URL =
  process.env.COINGECKO_API_URL ??
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true';

const SYMBOL_BY_COINGECKO_ID: Record<string, string> = { bitcoin: 'BTC', ethereum: 'ETH' };
const BYBIT_SYMBOLS: { symbol: string; bybit: string }[] = [
  { symbol: 'BTC', bybit: 'BTCUSDT' },
  { symbol: 'ETH', bybit: 'ETHUSDT' },
  { symbol: 'SOL', bybit: 'SOLUSDT' },
];

async function quotesFromBybit(onlySymbols?: Set<string>): Promise<SpotQuote[]> {
  const quotes: SpotQuote[] = [];
  for (const item of BYBIT_SYMBOLS) {
    if (onlySymbols && !onlySymbols.has(item.symbol)) continue;
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
  const streamFresh = bybitStreamIsFresh();

  let quotes: SpotQuote[] = [];
  if (streamFresh) {
    quotes = await quotesFromBybit(new Set(['SOL']));
    if (!quotes.some((quote) => quote.symbol === 'SOL')) {
      quotes.push(...(await quotesFromCoinGecko(new Set(['SOL']))));
    }
  } else {
    quotes = await quotesFromBybit();
    const have = new Set(quotes.map((quote) => quote.symbol));
    const missing = new Set(Object.values(SYMBOL_BY_COINGECKO_ID).filter((symbol) => !have.has(symbol)));
    quotes.push(...(await quotesFromCoinGecko(missing)));
  }

  if (quotes.length === 0 && !streamFresh) {
    noteProvider('crypto', 'error', new Error('no verified quotes'));
    await prunePriceHistory();
    return;
  }
  if (quotes.length > 0) noteProvider('crypto', 'ok');
  else if (streamFresh) noteProvider('crypto', 'ok');

  const now = new Date();
  for (const quote of quotes) {
    await ingestSpotQuote(quote, now, true);
  }

  await prunePriceHistory(now);
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
      if (!bybitStreamIsFresh()) noteProvider('crypto', 'error', error);
      console.warn('[cryptoFeed] tick failed — keeping last cached prices:', safeError(error));
    } finally {
      inFlight = false;
      if (workersAcceptTicks()) setTimeout(run, TICK_INTERVAL_MS);
    }
  };

  run();
}
