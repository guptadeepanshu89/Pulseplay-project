import type { MarketEvent } from '@/types/event';

export interface EventScoreSocketData {
  category?: string;
  homeScore?: string | number;
  awayScore?: string | number;
  scoreLabel?: string;
  minuteLabel?: string;
  provider?: string;
  asOf?: string;
  stale?: boolean;
}

/** Patch a MarketEvent from an events.updated socket payload. Returns the same reference if unchanged. */
export function applyEventScoreUpdate(event: MarketEvent, entityId: number, data?: EventScoreSocketData | null): MarketEvent {
  if (event.id !== entityId || !data) return event;

  const next: MarketEvent = {
    ...event,
    scoresUnavailable: false,
    scoresStale: data.stale === true,
    scoresProvider: typeof data.provider === 'string' ? data.provider : event.scoresProvider,
    scoresUpdatedAt: typeof data.asOf === 'string' ? data.asOf : event.scoresUpdatedAt,
  };

  if (typeof data.scoreLabel === 'string') next.scoreLabel = data.scoreLabel;
  if (typeof data.minuteLabel === 'string') next.minuteLabel = data.minuteLabel;

  if (event.category === 'CRICKET' || data.category === 'CRICKET') {
    // Cricket cards prefer scoreLabel; keep team score objects without inventing wickets as away.
    if (event.homeTeam && data.homeScore != null) {
      next.homeTeam = { ...event.homeTeam, score: data.homeScore };
    }
    return next;
  }

  if (event.homeTeam && data.homeScore != null) {
    next.homeTeam = { ...event.homeTeam, score: data.homeScore };
  }
  if (event.awayTeam && data.awayScore != null) {
    next.awayTeam = { ...event.awayTeam, score: data.awayScore };
  }
  return next;
}
