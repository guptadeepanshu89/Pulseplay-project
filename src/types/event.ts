export type EventCategory = 'CRICKET' | 'FOOTBALL' | 'CRYPTO' | 'ELECTION';

export type EventStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED';

export interface MarketEvent {
  id: number;
  category: EventCategory;
  name: string;
  competition: string;
  startTime: string;
  status: EventStatus;
  scoreLabel?: string;
  minuteLabel?: string;
  homeTeam?: EventParticipant;
  awayTeam?: EventParticipant;
  symbol?: string;
}

export interface EventParticipant {
  name: string;
  shortName: string;
  score?: number | string;
}
