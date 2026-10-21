import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { reduceSequence } from './sequence';

describe('live event sequence', () => {
  it('ignores a duplicate or older event and asks for a snapshot after a gap', () => {
    const first = reduceSequence({ last: null, instanceId: null }, { type: 'odds.updated', entityId: 4, seq: 3, instanceId: 'a' });
    assert.equal(first.action, 'apply');
    const duplicate = reduceSequence(first.state, { type: 'odds.updated', entityId: 4, seq: 3, instanceId: 'a' });
    assert.equal(duplicate.action, 'ignore');
    const older = reduceSequence(first.state, { type: 'odds.updated', entityId: 4, seq: 2, instanceId: 'a' });
    assert.equal(older.action, 'ignore');
    const gap = reduceSequence(first.state, { type: 'odds.updated', entityId: 9, seq: 6, instanceId: 'a' });
    assert.equal(gap.action, 'resync');
    assert.equal(gap.state.last, 6);
  });

  it('asks for a snapshot when the API process instance changes', () => {
    const first = reduceSequence({ last: null, instanceId: null }, { type: 'odds.updated', entityId: 1, seq: 2, instanceId: 'proc-1' });
    const restarted = reduceSequence(first.state, { type: 'odds.updated', entityId: 1, seq: 1, instanceId: 'proc-2' });
    assert.equal(restarted.action, 'resync');
    assert.equal(restarted.state.instanceId, 'proc-2');
    assert.equal(restarted.state.last, 1);
  });

  it('always applies reconnect, poll, and foreground signals', () => {
    const state = { last: 4, instanceId: 'a' };
    assert.equal(reduceSequence(state, { type: 'socket.reconnected', entityId: 0 }).action, 'apply');
    assert.equal(reduceSequence(state, { type: 'poll', entityId: 0 }).action, 'apply');
    assert.equal(reduceSequence(state, { type: 'app.foreground', entityId: 0 }).action, 'apply');
  });
});
