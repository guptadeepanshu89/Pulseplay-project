import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyCricketUpdate, applyCryptoSpot, mergeCryptoHistory } from './providerUpdates';

const history = {
  points: [{ timestamp: 1, price: 100 }],
  currentPrice: 100,
  changePercent: 1,
  changeAmount: 1,
  stale: false,
  asOf: 1_000,
};

describe('provider socket updates', () => {
  it('updates only the matching crypto symbol and ignores an older price', () => {
    const next = applyCryptoSpot(history, { type: 'crypto.updated', data: { symbol: 'BTCUSDT', price: 101, provider: 'bybit', asOf: '1970-01-01T00:00:02.000Z' } }, 'BTC');
    assert.equal(next?.currentPrice, 101);
    const older = applyCryptoSpot(next, { type: 'crypto.updated', data: { symbol: 'BTCUSDT', price: 90, asOf: '1970-01-01T00:00:01.000Z' } }, 'BTC');
    assert.equal(older?.currentPrice, 101);
    const other = applyCryptoSpot(next, { type: 'crypto.updated', data: { symbol: 'ETHUSDT', price: 50, asOf: '1970-01-01T00:00:03.000Z' } }, 'BTC');
    assert.equal(other?.currentPrice, 101);
    const odds = applyCryptoSpot(next, { type: 'odds.updated', data: { price: 2 } }, 'BTC');
    assert.equal(odds?.currentPrice, 101);
  });

  it('keeps a newer socket price when an older REST snapshot arrives', () => {
    const live = applyCryptoSpot(history, { type: 'crypto.updated', data: { symbol: 'BTCUSDT', price: 110, asOf: '1970-01-01T00:00:05.000Z' } }, 'BTC');
    const merged = mergeCryptoHistory(live, { ...history, currentPrice: 100, asOf: 1_000 });
    assert.equal(merged.currentPrice, 110);
  });

  it('updates only the matching cricket match and leaves simulator mode unchanged', () => {
    const matches = [
      { id: 'match-a', title: 'A', status: 'live', score: '10/1' },
      { id: 'match-b', title: 'B', status: 'live', score: '20/2' },
    ];
    const seen = new Map<string, number>();
    const event = { type: 'cricket.updated', data: { matchId: 'match-a', status: 'live', score: '12/1', asOf: '1970-01-01T00:00:02.000Z' } };
    const simulator = applyCricketUpdate(matches, event, 'simulator', seen);
    assert.equal(simulator[0].score, '10/1');
    const updated = applyCricketUpdate(matches, event, 'provider', seen);
    assert.equal(updated[0].score, '12/1');
    assert.equal(updated[1].score, '20/2');
    const unrelated = applyCricketUpdate(updated, { type: 'odds.updated', data: { matchId: 'match-a', score: '99/9' } }, 'provider', seen);
    assert.equal(unrelated[0].score, '12/1');
    const older = applyCricketUpdate(updated, { type: 'cricket.updated', data: { matchId: 'match-a', score: '1/0', asOf: '1970-01-01T00:00:01.000Z' } }, 'provider', seen);
    assert.equal(older[0].score, '12/1');
  });
});
