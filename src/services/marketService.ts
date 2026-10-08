import { apiRequest, ApiError } from '@/api/client';
import { Market } from '@/types/market';

export async function getMarkets(): Promise<Market[]> {
  return apiRequest<Market[]>('/markets');
}

export async function getMarketById(marketId: number): Promise<Market | undefined> {
  try {
    return await apiRequest<Market>(`/markets/${marketId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

export async function getMarketsByEventId(eventId: number): Promise<Market[]> {
  return apiRequest<Market[]>(`/events/${eventId}/markets`);
}
