import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import { createLivePoll, shouldPoll } from './pollLoop';

function harness(initiallyConnected = false) {
  const events: string[] = [];
  let connected = initiallyConnected;
  const poll = createLivePoll({
    onUpdate: (event) => events.push(event.type),
    connected: () => connected,
    appActive: true,
  });
  return {
    events,
    poll,
    setConnected(next: boolean) {
      connected = next;
      poll.sync();
    },
  };
}

describe('shouldPoll', () => {
  it('polls only when the screen is active, app is foreground, and socket is down', () => {
    assert.equal(shouldPoll({ socketConnected: false, screenActive: true, appActive: true }), true);
    assert.equal(shouldPoll({ socketConnected: true, screenActive: true, appActive: true }), false);
    assert.equal(shouldPoll({ socketConnected: false, screenActive: false, appActive: true }), false);
    assert.equal(shouldPoll({ socketConnected: false, screenActive: true, appActive: false }), false);
  });
});

describe('live poll fallback', () => {
  afterEach(() => {
    mock.timers.reset();
  });

  it('does not poll while the socket is connected', () => {
    mock.timers.enable({ apis: ['setInterval'] });
    const { events, poll } = harness(true);
    poll.sync();
    mock.timers.tick(20000);
    assert.equal(poll.isPolling(), false);
    assert.deepEqual(events, []);
  });

  it('refreshes on an 8 second interval after disconnect and stops after reconnect', () => {
    mock.timers.enable({ apis: ['setInterval'] });
    const { events, poll, setConnected } = harness(true);
    poll.sync();
    setConnected(false);
    mock.timers.tick(7999);
    assert.deepEqual(events, []);
    mock.timers.tick(1);
    assert.deepEqual(events, ['poll']);
    mock.timers.tick(8000);
    assert.deepEqual(events, ['poll', 'poll']);

    setConnected(true);
    events.push('socket.reconnected');
    mock.timers.tick(20000);
    assert.equal(poll.isPolling(), false);
    assert.deepEqual(events, ['poll', 'poll', 'socket.reconnected']);
  });

  it('does not start a second loop when disconnect is reported twice', () => {
    mock.timers.enable({ apis: ['setInterval'] });
    const { events, poll, setConnected } = harness(false);
    poll.sync();
    setConnected(false);
    mock.timers.tick(8000);
    assert.deepEqual(events, ['poll']);
  });

  it('clears the timer on unsubscribe and ignores a later sync', () => {
    mock.timers.enable({ apis: ['setInterval'] });
    const { events, poll, setConnected } = harness(false);
    poll.sync();
    poll.stop();
    setConnected(false);
    mock.timers.tick(20000);
    assert.equal(poll.isPolling(), false);
    assert.deepEqual(events, []);
  });

  it('stops polling in the background and refreshes when the app returns', () => {
    mock.timers.enable({ apis: ['setInterval'] });
    const { events, poll } = harness(false);
    poll.sync();
    poll.setAppActive(false);
    mock.timers.tick(20000);
    assert.deepEqual(events, []);
    assert.equal(poll.isPolling(), false);

    poll.setAppActive(true);
    assert.deepEqual(events, ['app.foreground']);
    assert.equal(poll.isPolling(), true);
    mock.timers.tick(8000);
    assert.deepEqual(events, ['app.foreground', 'poll']);
  });
});
