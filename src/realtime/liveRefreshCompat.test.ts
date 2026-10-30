import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { LIVE_RESYNC_TYPES } from './liveRefreshPolicy';
import { normalizeLiveRefreshArgs } from './liveRefreshArgs';

describe('normalizeLiveRefreshArgs', () => {
  it('maps legacy positional marketIds + callbacks into options', () => {
    const onOdds = () => undefined;
    const onEvent = () => true;
    const options = normalizeLiveRefreshArgs([7, 8], onOdds, onEvent);
    assert.deepEqual(options.marketIds, [7, 8]);
    assert.equal(options.onOdds, onOdds);
    assert.equal(options.onEvent, onEvent);
    assert.equal(options.refreshTypes, undefined);
  });

  it('passes through the options-object API unchanged', () => {
    const onOdds = () => undefined;
    const options = normalizeLiveRefreshArgs({
      marketIds: [3],
      onOdds,
      refreshTypes: LIVE_RESYNC_TYPES,
      staleMs: 0,
    });
    assert.deepEqual(options.marketIds, [3]);
    assert.equal(options.onOdds, onOdds);
    assert.equal(options.refreshTypes, LIVE_RESYNC_TYPES);
    assert.equal(options.staleMs, 0);
  });

  it('defaults empty options when omitted', () => {
    assert.deepEqual(normalizeLiveRefreshArgs(), {});
  });
});
