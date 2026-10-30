import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BETS_REFRESH_TYPES,
  createDebouncedRunner,
  createInflightDedupe,
  createKeyedInflightDedupe,
  HOME_REFRESH_TYPES,
  isDataStale,
  LIVE_RESYNC_TYPES,
  MARKETS_REFRESH_TYPES,
  NOTIFICATION_SOCKET_TYPES,
  shouldHttpRefresh,
  WALLET_SOCKET_TYPES,
} from './liveRefreshPolicy';
import { marketRoomDiff } from './marketRooms';

describe('shouldHttpRefresh', () => {
  it('allows only listed resync types and never socket.connected', () => {
    assert.equal(shouldHttpRefresh('poll', LIVE_RESYNC_TYPES), true);
    assert.equal(shouldHttpRefresh('socket.reconnected', LIVE_RESYNC_TYPES), true);
    assert.equal(shouldHttpRefresh('socket.connected', LIVE_RESYNC_TYPES), false);
    assert.equal(shouldHttpRefresh('crypto.updated', LIVE_RESYNC_TYPES), false);
    assert.equal(shouldHttpRefresh('cricket.updated', LIVE_RESYNC_TYPES), false);
    assert.equal(shouldHttpRefresh('events.updated', LIVE_RESYNC_TYPES), false);
  });

  it('keeps Home from refetching on crypto/cricket ticks', () => {
    assert.equal(shouldHttpRefresh('crypto.updated', HOME_REFRESH_TYPES), false);
    assert.equal(shouldHttpRefresh('cricket.updated', HOME_REFRESH_TYPES), false);
    assert.equal(shouldHttpRefresh('bet.settled', HOME_REFRESH_TYPES), true);
    assert.equal(shouldHttpRefresh('bet.placed', HOME_REFRESH_TYPES), true);
  });

  it('scopes Markets and Bets to their lifecycle events', () => {
    assert.equal(shouldHttpRefresh('market.settled', MARKETS_REFRESH_TYPES), true);
    assert.equal(shouldHttpRefresh('bet.settled', MARKETS_REFRESH_TYPES), false);
    assert.equal(shouldHttpRefresh('bet.settled', BETS_REFRESH_TYPES), true);
    assert.equal(shouldHttpRefresh('market.settled', BETS_REFRESH_TYPES), false);
    assert.equal(shouldHttpRefresh('crypto.updated', BETS_REFRESH_TYPES), false);
  });
});

describe('isDataStale', () => {
  it('treats never-fetched and expired data as stale', () => {
    assert.equal(isDataStale(0, 1000, 30_000), true);
    assert.equal(isDataStale(1000, 10_000, 30_000), false);
    assert.equal(isDataStale(1000, 40_000, 30_000), true);
    assert.equal(isDataStale(5000, 5001, 0), true);
  });
});

describe('createDebouncedRunner', () => {
  it('coalesces bursts into a single run', () => {
    const calls: number[] = [];
    const queued: Array<() => void> = [];
    const runner = createDebouncedRunner(
      10,
      (fn) => {
        queued.push(fn);
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      () => {
        queued.length = 0;
      },
    );

    runner.schedule(() => calls.push(1));
    runner.schedule(() => calls.push(2));
    runner.schedule(() => calls.push(3));
    assert.equal(calls.length, 0);
    assert.equal(queued.length, 1);
    queued[0]();
    assert.deepEqual(calls, [3]);
  });

  it('cancel drops a pending run', () => {
    const calls: number[] = [];
    let pending: (() => void) | undefined;
    const runner = createDebouncedRunner(
      10,
      (fn) => {
        pending = fn;
        return 1 as unknown as ReturnType<typeof setTimeout>;
      },
      () => undefined,
    );
    runner.schedule(() => calls.push(1));
    runner.cancel();
    pending?.();
    assert.deepEqual(calls, []);
  });
});


describe('createInflightDedupe', () => {
  it('reuses one in-flight promise for concurrent callers', async () => {
    const dedupe = createInflightDedupe<number>();
    let runs = 0;
    const shared = () =>
      new Promise<number>((resolve) => {
        runs += 1;
        setTimeout(() => resolve(runs), 5);
      });

    const [a, b] = await Promise.all([dedupe(shared), dedupe(shared)]);
    assert.equal(a, 1);
    assert.equal(b, 1);
    assert.equal(runs, 1);

    const c = await dedupe(shared);
    assert.equal(c, 2);
    assert.equal(runs, 2);
  });
});

describe('createKeyedInflightDedupe', () => {
  it('dedupes by key and isolates different keys', async () => {
    const dedupe = createKeyedInflightDedupe<string>();
    let runs = 0;
    const make = (label: string) => () =>
      new Promise<string>((resolve) => {
        runs += 1;
        setTimeout(() => resolve(label), 5);
      });

    const [a, b, c] = await Promise.all([
      dedupe('7', make('event-7')),
      dedupe('7', make('event-7-again')),
      dedupe('8', make('event-8')),
    ]);
    assert.equal(a, 'event-7');
    assert.equal(b, 'event-7');
    assert.equal(c, 'event-8');
    assert.equal(runs, 2);
  });
});

describe('global socket-only providers', () => {
  it('wallet and notifications never HTTP-refresh on poll or reconnect', () => {
    for (const type of ['poll', 'socket.reconnected', 'app.foreground', 'snapshot.required', 'crypto.updated']) {
      assert.equal(shouldHttpRefresh(type, WALLET_SOCKET_TYPES), false);
      assert.equal(shouldHttpRefresh(type, NOTIFICATION_SOCKET_TYPES), false);
    }
    assert.equal(shouldHttpRefresh('wallet.updated', WALLET_SOCKET_TYPES), true);
    assert.equal(shouldHttpRefresh('bet.settled', WALLET_SOCKET_TYPES), true);
    assert.equal(shouldHttpRefresh('notification.created', NOTIFICATION_SOCKET_TYPES), true);
  });
});

describe('marketRoomDiff', () => {
  it('subscribes only new rooms and unsubscribes removed ones', () => {
    assert.deepEqual(marketRoomDiff([1, 2], [2, 3]), { subscribe: [3], unsubscribe: [1] });
    assert.deepEqual(marketRoomDiff([], [4]), { subscribe: [4], unsubscribe: [] });
    assert.deepEqual(marketRoomDiff([5], []), { subscribe: [], unsubscribe: [5] });
  });

  it('reconnect from empty joined set re-subscribes all desired ids without duplicates', () => {
    assert.deepEqual(marketRoomDiff([], [10, 11]), { subscribe: [10, 11], unsubscribe: [] });
    assert.deepEqual(marketRoomDiff([10, 11], [10, 11]), { subscribe: [], unsubscribe: [] });
  });
});
