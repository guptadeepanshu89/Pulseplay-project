import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ballLabel,
  formatCricketOvers,
  isCricketMatchUuid,
  oversToDecimal,
  parseBallByBall,
  parseBbbEnabled,
  parseChaseFromStatus,
  parseInningsScores,
  parseScorecard,
  parseTeamInfo,
} from './cricketPayload';

const scorecardPayload = {
  data: {
    status: 'India needs 24 runs in 12 balls',
    teamInfo: [
      { name: 'India', shortname: 'IND', img: 'https://example.com/ind.png' },
      { name: 'Australia', shortname: 'AUS' },
    ],
    score: [
      { r: 180, w: 6, o: 20, inning: 'Australia Inning 1' },
      { r: 157, w: 3, o: 18.2, inning: 'India Inning 1' },
    ],
    scorecard: [
      {
        inning: 'India Inning 1',
        batting: [
          { batsman: 'Rohit Sharma', dismissal: 'c Smith b Starc', r: 45, b: 32, '4s': 4, '6s': 2, sr: 140.62 },
          { batsman: 'Virat Kohli', dismissal: 'batting', r: 62, b: 44, '4s': 5, '6s': 1, sr: 140.9 },
          { batsman: 'Suryakumar Yadav', dismissal: 'not out', r: 22, b: 14, '4s': 2, '6s': 1, sr: 157.14 },
        ],
        bowling: [{ bowler: 'Mitchell Starc', o: 3.2, m: 0, r: 28, w: 1, eco: 8.4 }],
      },
    ],
  },
};

const bbbPayload = {
  data: {
    bbb: [
      { inning: 1, overs: 18.1, batsman: 'Virat Kohli', nonstriker: 'Suryakumar Yadav', bowler: 'Mitchell Starc', runs: 0, event: '0' },
      { inning: 1, overs: 18.2, batsman: 'Virat Kohli', nonstriker: 'Suryakumar Yadav', bowler: 'Mitchell Starc', runs: 4, event: '4', commentary: 'Cover drive for four' },
      { inning: 1, overs: 18.3, batsman: 'Virat Kohli', bowler: 'Mitchell Starc', event: 'wd', extras: 'wide' },
      { inning: 1, overs: 18.3, batsman: 'Virat Kohli', bowler: 'Mitchell Starc', event: 'W', wicket: 'caught', commentary: 'Kohli is gone' },
    ],
  },
};

describe('cricket payload parsers', () => {
  it('reads innings as runs/wickets with cricket overs and team flags', () => {
    const innings = parseInningsScores(scorecardPayload);
    assert.equal(innings[1]?.runs, 157);
    assert.equal(innings[1]?.wickets, 3);
    assert.equal(innings[1]?.overs, 18.2);
    assert.equal(formatCricketOvers(18.2), '18.2');
    assert.equal(oversToDecimal(18.2), 18 + 2 / 6);
    const teams = parseTeamInfo(scorecardPayload);
    assert.equal(teams[0]?.shortName, 'IND');
    assert.equal(teams[0]?.imageUrl, 'https://example.com/ind.png');
  });

  it('reads batting and bowling scorecard rows without filling missing stats', () => {
    const [card] = parseScorecard(scorecardPayload);
    assert.equal(card.batting[1]?.name, 'Virat Kohli');
    assert.equal(card.batting[1]?.runs, 62);
    assert.equal(card.batting[1]?.balls, 44);
    assert.equal(card.bowling[0]?.wickets, 1);
    assert.equal(card.bowling[0]?.economy, 8.4);
  });

  it('classifies ball-by-ball extras, boundaries and wickets from provider fields', () => {
    const balls = parseBallByBall(bbbPayload);
    assert.equal(balls.length, 4);
    assert.equal(balls[0]?.kind, 'dot');
    assert.equal(ballLabel(balls[0]!), '•');
    assert.equal(balls[1]?.kind, 'boundary');
    assert.equal(balls[1]?.overBall, '18.2');
    assert.equal(balls[2]?.kind, 'wide');
    assert.equal(balls[3]?.kind, 'wicket');
    assert.equal(balls[3]?.wicket, 'caught');
  });

  it('returns no deliveries when the provider omits ball-by-ball data', () => {
    assert.deepEqual(parseBallByBall({ data: { status: 'Match starting' } }), []);
  });

  it('parses chase text from provider status without inventing a target', () => {
    const chase = parseChaseFromStatus('India needs 24 runs in 12 balls');
    assert.deepEqual(chase, { needs: 24, balls: 12 });
    assert.equal(parseChaseFromStatus('Innings Break'), null);
  });

  it('reads bbbEnabled and validates CricketData match UUIDs', () => {
    assert.equal(parseBbbEnabled({ data: { bbbEnabled: false } }), false);
    assert.equal(parseBbbEnabled({ data: { bbbEnabled: true } }), true);
    assert.equal(parseBbbEnabled({ data: { status: 'live' } }), undefined);
    assert.equal(isCricketMatchUuid('5e5a4c99-ab45-4f16-8593-c9aa1ba0bba6'), true);
    assert.equal(isCricketMatchUuid('not-a-match'), false);
  });
});
