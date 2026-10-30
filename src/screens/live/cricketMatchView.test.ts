import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { MarketEvent } from '../../types/event';
import { buildCricketMatchView, cricketUiStatus } from './cricketMatchView';

const liveMapped = (): MarketEvent => ({
  id: 1,
  category: 'CRICKET',
  name: 'India vs Australia',
  competition: 'T20I',
  startTime: new Date().toISOString(),
  status: 'LIVE',
  scoreLabel: '157/3',
  minuteLabel: 'Over 18.2',
  homeTeam: { name: 'India', shortName: 'IND' },
  awayTeam: { name: 'Australia', shortName: 'AUS' },
  scoresProvider: 'cricapi',
  scoresUpdatedAt: new Date().toISOString(),
  providerMatchId: '189a5631-8bae-4d2f-8a21-3d31219b1bc2',
});

describe('cricket match view', () => {
  it('maps event status to LIVE, UPCOMING, BREAK and COMPLETED from real state', () => {
    assert.equal(cricketUiStatus(liveMapped()), 'LIVE');
    assert.equal(cricketUiStatus({ ...liveMapped(), status: 'SCHEDULED' }), 'UPCOMING');
    assert.equal(cricketUiStatus({ ...liveMapped(), status: 'COMPLETED' }), 'COMPLETED');
    assert.equal(cricketUiStatus(liveMapped(), 'Innings Break'), 'BREAK');
  });

  it('shows unmapped reason and does not invent batters or commentary', () => {
    const view = buildCricketMatchView({
      event: {
        ...liveMapped(),
        scoresProvider: undefined,
        scoresUpdatedAt: undefined,
        providerMatchId: undefined,
        scoreLabel: '999/0',
      },
    });
    assert.equal(view.header.scoresUnavailable, true);
    assert.equal(view.header.unavailableReason, 'UNMAPPED');
    assert.equal(view.header.battingScore, undefined);
    assert.equal(view.batters.length, 0);
    assert.equal(view.commentary.length, 0);
  });

  it('shows provider match_info scores even when the live-score worker has not confirmed yet', () => {
    const view = buildCricketMatchView({
      event: {
        ...liveMapped(),
        scoresProvider: undefined,
        scoresUpdatedAt: undefined,
        scoreLabel: undefined,
        minuteLabel: undefined,
      },
      scorePayload: {
        data: {
          status: 'Denmark opt to bat',
          score: [{ r: 61, w: 3, o: 12, inning: 'denmark Inning 1' }],
          teamInfo: [{ name: 'Denmark', shortname: 'DEN' }, { name: 'Qatar', shortname: 'QAT' }],
        },
      },
    });
    assert.equal(view.header.scoresUnavailable, false);
    assert.equal(view.header.battingScore, '61/3');
    assert.equal(view.header.oversLabel, '12 overs');
  });

  it('formats runs/wickets and cricket overs from provider innings and scorecard', () => {
    const view = buildCricketMatchView({
      event: liveMapped(),
      scorecardPayload: {
        data: {
          status: 'India needs 24 runs in 12 balls',
          score: [
            { r: 180, w: 6, o: 20, inning: 'Australia Inning 1' },
            { r: 157, w: 3, o: 18.2, inning: 'India Inning 1' },
          ],
          scorecard: [
            {
              inning: 'India Inning 1',
              batting: [
                { batsman: 'Virat Kohli', dismissal: 'batting', r: 62, b: 44, '4s': 5, '6s': 1, sr: 140.9 },
                { batsman: 'Suryakumar Yadav', dismissal: 'not out', r: 22, b: 14, '4s': 2, '6s': 1, sr: 157.14 },
              ],
              bowling: [{ bowler: 'Mitchell Starc', o: 3.2, r: 28, w: 1, eco: 8.4 }],
            },
          ],
        },
      },
      commentaryPayload: {
        data: {
          bbb: [
            { overs: 18.1, batsman: 'Virat Kohli', nonstriker: 'Suryakumar Yadav', bowler: 'Mitchell Starc', event: '1', commentary: 'Worked to midwicket' },
            { overs: 18.2, batsman: 'Virat Kohli', nonstriker: 'Suryakumar Yadav', bowler: 'Mitchell Starc', event: '4', commentary: 'Four through covers' },
          ],
        },
      },
    });
    assert.equal(view.header.battingScore, '157/3');
    assert.equal(view.header.oversLabel, '18.2 overs');
    assert.equal(view.header.target, '181');
    assert.equal(view.header.requiredRunRate, '12.00');
    assert.equal(view.batters[0]?.name, 'Virat Kohli');
    assert.equal(view.batters[0]?.runs, 62);
    assert.equal(view.bowler?.name, 'Mitchell Starc');
    assert.equal(view.currentOver.length, 2);
    assert.equal(view.currentOver[1]?.kind, 'boundary');
    assert.equal(view.commentary[0]?.overBall, '18.2');
    assert.equal(view.commentaryUnavailable, false);
  });

  it('uses an unavailable commentary state when the provider returns no lines', () => {
    const view = buildCricketMatchView({
      event: liveMapped(),
      commentaryPayload: { data: { status: 'Match starting' } },
      commentaryError: false,
    });
    assert.equal(view.commentary.length, 0);
    assert.equal(view.commentaryUnavailable, true);
  });
});
