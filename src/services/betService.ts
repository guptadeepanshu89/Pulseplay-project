import { apiRequest, ApiError } from '@/api/client';
import { Bet, BetSlipSelection } from '@/types/bet';

export async function getRecentBets(limit = 5): Promise<Bet[]> {
  const bets = await apiRequest<Bet[]>('/bets');
  return bets.slice(0, limit);
}

export async function getAllBets(): Promise<Bet[]> {
  return apiRequest<Bet[]>('/bets');
}

export async function getBetById(betId: number): Promise<Bet | undefined> {
  try {
    return await apiRequest<Bet>(`/bets/${betId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return undefined;
    throw error;
  }
}

export async function placeBet(selections: BetSlipSelection[], stake: number): Promise<Bet> {
  return apiRequest<Bet>('/bets', {
    method: 'POST',
    body: { selections, stake },
  });
}
