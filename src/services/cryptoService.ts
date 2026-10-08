import { apiRequest } from '@/api/client';
import { ChartTimeframe, CryptoPriceHistory } from '@/types/crypto';

export async function getCryptoPriceHistory(symbol: string, timeframe: ChartTimeframe): Promise<CryptoPriceHistory> {
  return apiRequest<CryptoPriceHistory>(`/crypto/${symbol}/price-history?timeframe=${timeframe}`);
}
