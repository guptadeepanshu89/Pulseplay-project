import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { HOME_REFRESH_TYPES, LIVE_RESYNC_TYPES, shouldHttpRefresh } from './liveRefreshPolicy';

/**
 * Mirrors useLiveRefresh decision order without mounting React Navigation:
 * odds → onEvent handled → allowlisted HTTP refresh.
 */
function decideRefresh(
  type: string,
  options: {
    refreshTypes?: readonly string[];
    onEventHandled?: boolean;
    isOdds?: boolean;
  } = {},
): 'odds' | 'handled' | 'http' | 'ignore' {
  if (options.isOdds || type === 'odds.updated') return 'odds';
  if (options.onEventHandled) return 'handled';
  if (shouldHttpRefresh(type, options.refreshTypes ?? LIVE_RESYNC_TYPES)) return 'http';
  return 'ignore';
}

describe('screen live refresh gate', () => {
  it('Home ignores provider broadcasts and dual connect signal', () => {
    assert.equal(decideRefresh('crypto.updated', { refreshTypes: HOME_REFRESH_TYPES }), 'ignore');
    assert.equal(decideRefresh('cricket.updated', { refreshTypes: HOME_REFRESH_TYPES }), 'ignore');
    assert.equal(decideRefresh('socket.connected', { refreshTypes: HOME_REFRESH_TYPES }), 'ignore');
    assert.equal(decideRefresh('events.updated', { refreshTypes: HOME_REFRESH_TYPES, onEventHandled: true }), 'handled');
    assert.equal(decideRefresh('odds.updated', { refreshTypes: HOME_REFRESH_TYPES }), 'odds');
    assert.equal(decideRefresh('poll', { refreshTypes: HOME_REFRESH_TYPES }), 'http');
    assert.equal(decideRefresh('socket.reconnected', { refreshTypes: HOME_REFRESH_TYPES }), 'http');
  });

  it('opening BTC path does not HTTP-refresh from cricket events', () => {
    assert.equal(decideRefresh('cricket.updated', { onEventHandled: false }), 'ignore');
    assert.equal(decideRefresh('crypto.updated', { onEventHandled: true }), 'handled');
  });

  it('opening Cricket path does not HTTP-refresh from crypto events', () => {
    assert.equal(decideRefresh('crypto.updated', { onEventHandled: false }), 'ignore');
    assert.equal(decideRefresh('cricket.updated', { onEventHandled: true }), 'handled');
  });

  it('blurred Home does not schedule HTTP when handler is marked inactive', () => {
    let alive = true;
    const scheduled: string[] = [];
    const onUpdate = (type: string) => {
      if (!alive) return;
      if (decideRefresh(type, { refreshTypes: HOME_REFRESH_TYPES }) === 'http') scheduled.push(type);
    };
    alive = false;
    onUpdate('poll');
    onUpdate('socket.reconnected');
    onUpdate('bet.settled');
    assert.deepEqual(scheduled, []);
  });
});
