import { describe, expect, it } from 'vitest';

import { nextEventStatus } from '../../src/workers/eventStatus';

const HOUR = 60 * 60 * 1000;

describe('event status', () => {
  it('does not mark a match completed just because the live window elapsed', () => {
    const kickoffMs = Date.parse('2026-10-11T12:00:00Z');
    const decision = nextEventStatus({ kickoffMs, nowMs: kickoffMs + 8 * HOUR, current: 'LIVE' });
    expect(decision.status).toBe('LIVE');
  });

  it('keeps a scheduled event scheduled before kickoff and live after kickoff', () => {
    const kickoffMs = Date.parse('2026-10-11T12:00:00Z');
    expect(nextEventStatus({ kickoffMs, nowMs: kickoffMs - 1000, current: 'SCHEDULED' }).status).toBe('SCHEDULED');
    expect(nextEventStatus({ kickoffMs, nowMs: kickoffMs + 1000, current: 'SCHEDULED' }).status).toBe('LIVE');
  });

  it('preserves cancelled, postponed, and completed statuses', () => {
    const kickoffMs = Date.parse('2026-10-11T12:00:00Z');
    for (const current of ['CANCELLED', 'POSTPONED', 'COMPLETED'] as const) {
      expect(nextEventStatus({ kickoffMs, nowMs: kickoffMs + 10 * HOUR, current }).status).toBe(current);
    }
  });
});
