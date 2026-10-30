import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyEventScoreUpdate } from './eventScoreUpdates';
import type { MarketEvent } from '@/types/event';

const base: MarketEvent = {
  id: 10,
  category: 'FOOTBALL',
  name: 'A vs B',
  competition: 'EPL',
  startTime: new Date().toISOString(),
  status: 'LIVE',
  scoresUnavailable: true,
  homeTeam: { name: 'A', shortName: 'A', score: undefined },
  awayTeam: { name: 'B', shortName: 'B', score: undefined },
};

describe('applyEventScoreUpdate', () => {
  it('patches football goals from events.updated', () => {
    const next = applyEventScoreUpdate(base, 10, {
      homeScore: '2',
      awayScore: '1',
      scoreLabel: '2-1',
      minuteLabel: "70'",
      provider: 'thesportsdb',
      asOf: '2026-10-25T12:00:00.000Z',
    });
    assert.equal(next.scoresUnavailable, false);
    assert.equal(next.homeTeam?.score, '2');
    assert.equal(next.awayTeam?.score, '1');
    assert.equal(next.minuteLabel, "70'");
  });

  it('ignores updates for other event ids', () => {
    const next = applyEventScoreUpdate(base, 99, { homeScore: '5', awayScore: '5' });
    assert.equal(next, base);
  });
});
