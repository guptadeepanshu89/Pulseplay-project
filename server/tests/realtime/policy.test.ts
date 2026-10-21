import { describe, expect, it } from 'vitest';

import { shouldPoll } from '../../src/realtime/policy';

describe('polling fallback', () => {
  it('polls only while the screen is active, the app is foregrounded, and the socket is down', () => {
    expect(shouldPoll({ socketConnected: false, screenActive: true, appActive: true })).toBe(true);
    expect(shouldPoll({ socketConnected: true, screenActive: true, appActive: true })).toBe(false);
    expect(shouldPoll({ socketConnected: false, screenActive: false, appActive: true })).toBe(false);
    expect(shouldPoll({ socketConnected: false, screenActive: true, appActive: false })).toBe(false);
  });
});
