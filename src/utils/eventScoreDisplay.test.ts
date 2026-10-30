import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isImplausibleTeamScore, shouldHideLiveScores } from './eventScoreDisplay';
import type { MarketEvent } from '@/types/event';

const liveFootball = (overrides: Partial<MarketEvent> = {}): MarketEvent => ({
  id: 3,
  category: 'FOOTBALL',
  name: 'Liverpool vs Chelsea',
  competition: 'Premier League',
  startTime: new Date().toISOString(),
  status: 'LIVE',
  homeTeam: { name: 'Liverpool', shortName: 'LI', score: 16392 },
  awayTeam: { name: 'Chelsea', shortName: 'CH', score: 16314 },
  minuteLabel: "68'",
  ...overrides,
});

describe('eventScoreDisplay', () => {
  it('treats inflated football/cricket numbers as implausible', () => {
    assert.equal(isImplausibleTeamScore('FOOTBALL', 16392), true);
    assert.equal(isImplausibleTeamScore('FOOTBALL', 2), false);
    assert.equal(isImplausibleTeamScore('CRICKET', 221401), true);
    assert.equal(isImplausibleTeamScore('CRICKET', 124), false);
  });

  it('hides unmapped LIVE scores so garbage numbers never render', () => {
    assert.equal(shouldHideLiveScores(liveFootball()), true);
    assert.equal(shouldHideLiveScores(liveFootball({ scoresUnavailable: true })), true);
    assert.equal(
      shouldHideLiveScores(
        liveFootball({
          scoresProvider: 'thesportsdb',
          scoresUpdatedAt: new Date().toISOString(),
          homeTeam: { name: 'Liverpool', shortName: 'LI', score: 2 },
          awayTeam: { name: 'Chelsea', shortName: 'CH', score: 1 },
        }),
      ),
      false,
    );
  });
});
