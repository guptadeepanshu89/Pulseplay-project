import type { MarketEvent } from '@/types/event';

/** Defensive: never show ticker-inflated garbage even if the API omits flags. */
export function isImplausibleTeamScore(category: MarketEvent['category'], score: number | string | undefined): boolean {
  if (score == null || score === '') return false;
  const n = typeof score === 'number' ? score : Number(score);
  if (!Number.isFinite(n)) return false;
  if (category === 'FOOTBALL') return n > 20;
  if (category === 'CRICKET') return n > 500;
  return false;
}

export function shouldHideLiveScores(event: MarketEvent): boolean {
  const sports = event.category === 'FOOTBALL' || event.category === 'CRICKET';
  if (event.status !== 'LIVE' || !sports) return false;
  if (event.scoresUnavailable) return true;
  if (!event.scoresProvider || !event.scoresUpdatedAt) {
    // Unmapped / never provider-confirmed — also hide implausible seed columns.
    if (isImplausibleTeamScore(event.category, event.homeTeam?.score)) return true;
    if (isImplausibleTeamScore(event.category, event.awayTeam?.score)) return true;
    // LIVE sports without provider confirmation: hide numeric team scores.
    return true;
  }
  return false;
}
