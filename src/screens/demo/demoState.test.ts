import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyDemoSnapshot, connectionLabel, demoScreenView } from './demoState';

const current = {
  demo: true as const,
  synthetic: true as const,
  settlesBets: false as const,
  id: 'demo-market' as const,
  title: 'Demo market',
  status: 'OPEN',
  version: 2,
  price: 1.51,
  updatedAt: '2026-10-18T06:00:00.000Z',
};

describe('demo snapshot ordering', () => {
  it('keeps a newer snapshot when an older or duplicate event arrives', () => {
    const older = { ...current, version: 1, price: 1.5, updatedAt: '2026-10-18T05:00:00.000Z' };
    assert.equal(applyDemoSnapshot(current, older), current);
    assert.equal(applyDemoSnapshot(current, current), current);
    const newer = { ...current, version: 3, price: 1.52, updatedAt: '2026-10-18T06:01:00.000Z' };
    assert.equal(applyDemoSnapshot(current, newer)?.version, 3);
    assert.equal(applyDemoSnapshot(null, current)?.version, 2);
  });

  it('shows loading only before the first snapshot, then empty or error without hiding a loaded snapshot', () => {
    assert.equal(demoScreenView({ loading: true, error: null, hasSnapshot: false }).showLoading, true);
    const empty = demoScreenView({ loading: false, error: null, hasSnapshot: false });
    assert.equal(empty.showEmpty, true);
    assert.equal(empty.showLoading, false);
    const failed = demoScreenView({ loading: false, error: 'Could not load the demo snapshot.', hasSnapshot: false });
    assert.equal(failed.showError, true);
    assert.equal(failed.showEmpty, false);
    const staleError = demoScreenView({ loading: false, error: 'Tick failed', hasSnapshot: true });
    assert.equal(staleError.showError, true);
    assert.equal(staleError.showSnapshot, true);
  });

  it('names the visible connection states', () => {
    assert.equal(connectionLabel('connected'), 'Live');
    assert.equal(connectionLabel('reconnecting'), 'Reconnecting');
    assert.equal(connectionLabel('disconnected'), 'Offline');
  });
});
