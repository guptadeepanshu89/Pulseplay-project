export type EventStatusCode = 'SCHEDULED' | 'LIVE' | 'COMPLETED' | 'CANCELLED' | 'POSTPONED';

// TheSportsDB's upcoming-fixtures feed does not include a finish, abandon, or
// postponement flag. Elapsed time after kickoff is not treated as proof the
// match is over. Terminal statuses already stored are left unchanged.
export function nextEventStatus(input: {
  kickoffMs: number;
  nowMs: number;
  current: EventStatusCode | null;
}): { status: EventStatusCode; review: boolean } {
  if (input.current === 'COMPLETED' || input.current === 'CANCELLED' || input.current === 'POSTPONED') {
    return { status: input.current, review: false };
  }
  if (input.nowMs < input.kickoffMs) return { status: 'SCHEDULED', review: false };
  return { status: 'LIVE', review: false };
}
