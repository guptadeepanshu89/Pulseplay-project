import { apiRequest } from '@/api/client';
import { ChartTimeframe, CryptoPriceHistory } from '@/types/crypto';

import {
  CRYPTO_PRICE_HISTORY_CACHE_MS,
  clearCryptoPriceHistoryCache,
  cryptoPriceHistoryKey,
  loadCachedCryptoPriceHistory,
} from './cryptoPriceHistoryCache';

export {
  CRYPTO_PRICE_HISTORY_CACHE_MS,
  clearCryptoPriceHistoryCache,
  cryptoPriceHistoryKey,
};

export async function getCryptoPriceHistory(
  symbol: string,
  timeframe: ChartTimeframe,
  options?: { signal?: AbortSignal; bypassCache?: boolean },
): Promise<CryptoPriceHistory> {
  const normalized = symbol.trim().toUpperCase();
  return loadCachedCryptoPriceHistory(
    normalized,
    timeframe,
    () =>
      apiRequest<CryptoPriceHistory>(`/crypto/${encodeURIComponent(normalized)}/price-history?timeframe=${timeframe}`, {
        signal: options?.signal,
      }),
    { bypassCache: options?.bypassCache },
  );
}
