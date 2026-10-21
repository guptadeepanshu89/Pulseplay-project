import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cricketFeedView, finishFeedLoad, initialFeedLoad, presentMatchCard, startFeedLoad } from './feedState';

describe('cricket feed loading', () => {
  it('shows loading only before the first response and clears it for an empty list', () => {
    const pending = startFeedLoad(initialFeedLoad());
    assert.equal(cricketFeedView(pending).showLoading, true);
    assert.equal(cricketFeedView(pending).showEmpty, false);

    const empty = finishFeedLoad(pending, { ok: true, matchCount: 0, stale: false });
    const view = cricketFeedView(empty);
    assert.equal(view.showLoading, false);
    assert.equal(view.showEmpty, true);
    assert.equal(view.showMatches, false);
    assert.equal(view.showError, false);
  });

  it('keeps matches visible on a later refresh and does not return to the loading state', () => {
    const ready = finishFeedLoad(startFeedLoad(initialFeedLoad()), { ok: true, matchCount: 2, stale: false });
    const refresh = startFeedLoad(ready);
    assert.equal(refresh.initialLoading, false);
    assert.equal(cricketFeedView(refresh).showLoading, false);
    assert.equal(cricketFeedView(refresh).showMatches, true);

    const failed = finishFeedLoad(ready, { ok: false, error: 'Could not load cricket data.' });
    const failedView = cricketFeedView(failed);
    assert.equal(failedView.showLoading, false);
    assert.equal(failedView.showError, true);
    assert.equal(failedView.showMatches, true);
    assert.equal(failed.matchCount, 2);
  });

  it('shows an API error instead of an empty list when the first request fails', () => {
    const failed = finishFeedLoad(startFeedLoad(initialFeedLoad()), { ok: false, error: 'Provider unavailable' });
    const view = cricketFeedView(failed);
    assert.equal(view.showLoading, false);
    assert.equal(view.showError, true);
    assert.equal(view.showEmpty, false);
    assert.equal(view.showMatches, false);
  });

  it('marks stale data without hiding the matches', () => {
    const stale = finishFeedLoad(startFeedLoad(initialFeedLoad()), { ok: true, matchCount: 1, stale: true });
    const view = cricketFeedView(stale);
    assert.equal(view.showStale, true);
    assert.equal(view.showMatches, true);
    assert.equal(view.showLoading, false);
  });
});

describe('cricket match cards', () => {
  it('splits teams, scores, and overs and omits a title that only repeats the teams', () => {
    const card = presentMatchCard({
      title: 'India vs Australia',
      status: 'Rain stops play',
      score: 'India Inning 1: 112/1 (21) · Australia Inning 1: 40/2 (8.3)',
      teams: ['India', 'Australia'],
    });
    assert.equal(card.title, null);
    assert.deepEqual(card.teams, ['India', 'Australia']);
    assert.equal(card.status, 'Rain stops play');
    assert.deepEqual(card.innings, [
      { team: 'India', score: '112/1', overs: '21' },
      { team: 'Australia', score: '40/2', overs: '8.3' },
    ]);
  });

  it('keeps a distinct match title and leaves missing scores and innings blank', () => {
    const card = presentMatchCard({
      title: 'India vs Australia, 1st T20',
      status: 'undefined',
      score: null,
      innings: 'undefined',
    });
    assert.equal(card.title, 'India vs Australia, 1st T20');
    assert.deepEqual(card.teams, ['India', 'Australia']);
    assert.equal(card.status, null);
    assert.deepEqual(card.innings, []);
  });
});
