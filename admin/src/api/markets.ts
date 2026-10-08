import { http } from './client';
import type { EventSummary, Market } from '../types';

// Shared, read-only routes (also used by the mobile app) — every role may call
// these; the admin panel reuses them instead of duplicating a markets list.
export async function listEvents(): Promise<EventSummary[]> {
  const { data } = await http.get('/events');
  return data;
}

export async function listMarkets(): Promise<Market[]> {
  const { data } = await http.get('/markets');
  return data;
}

export interface SettleResult {
  marketId: number;
  winningSelectionId: number;
  settledBets: unknown[];
}

export async function settleMarket(marketId: number, winningSelectionId: number): Promise<SettleResult> {
  const { data } = await http.post(`/admin/markets/${marketId}/settle`, { winningSelectionId });
  return data;
}
