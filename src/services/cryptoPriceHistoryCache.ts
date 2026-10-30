import type { ChartTimeframe, CryptoPriceHistory } from '@/types/crypto';

export const CRYPTO_PRICE_HISTORY_CACHE_MS = 60_000;

interface CacheEntry {
  at: number;
  value: CryptoPriceHistory;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CryptoPriceHistory>>();

export function cryptoPriceHistoryKey(symbol: string, timeframe: ChartTimeframe): string {
  return `${symbol.trim().toUpperCase()}:${timeframe}`;
}

export function clearCryptoPriceHistoryCache(): void {
  cache.clear();
  inflight.clear();
}

/** Shared cache + in-flight dedupe for price-history GETs. */
export async function loadCachedCryptoPriceHistory(
  symbol: string,
  timeframe: ChartTimeframe,
  request: () => Promise<CryptoPriceHistory>,
  options?: { bypassCache?: boolean; now?: number },
): Promise<CryptoPriceHistory> {
  const key = cryptoPriceHistoryKey(symbol, timeframe);
  const now = options?.now ?? Date.now();

  if (!options?.bypassCache) {
    const hit = cache.get(key);
    if (hit && now - hit.at < CRYPTO_PRICE_HISTORY_CACHE_MS) {
      return hit.value;
    }
  }

  const existing = inflight.get(key);
  if (existing) return existing;

  const pending = request()
    .then((value) => {
      cache.set(key, { at: Date.now(), value });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, pending);
  return pending;
}
