import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '../../src/core/errors';
import { clearCricketCache, getCommentary, getLiveMatches, getScore, redactProviderUrl, setCricketClock } from '../../src/modules/cricket/provider';
import * as hub from '../../src/realtime/hub';
import { bowlNext, getSimulatorMatch, resetSimulator } from '../../src/modules/cricket/simulator';
import { api, bearer, loginToken } from '../helpers/app';
import { createUserWithWallet } from '../helpers/factories';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearCricketCache();
  delete process.env.CRICKET_API_KEY;
  delete process.env.CRICKET_API_BASE;
  delete process.env.CRICKET_API_AUTH_MODE;
  delete process.env.CRICKET_API_DAILY_HIT_CAP;
  delete process.env.CRICKET_POLL_INTERVAL_MS;
  resetSimulator();
});

describe('cricket simulator', () => {
  it('resets the complete innings state', () => {
    bowlNext({ kind: 'four' });
    const reset = resetSimulator({ maxOvers: 5, maxWickets: 10, seed: 4 });
    expect(reset.source).toBe('simulator');
    expect(reset.simulated).toBe(true);
    expect(reset.runs).toBe(0);
    expect(reset.wickets).toBe(0);
    expect(reset.legalBalls).toBe(0);
    expect(reset.deliveries).toEqual([]);
    expect(reset.maxOvers).toBe(5);
    expect(reset.striker).toBe('A. Sharma');
  });

  it('scores a dot, a single, a four, and a six separately from extras', () => {
    resetSimulator();
    expect(bowlNext({ kind: 'dot' }).runs).toBe(0);
    expect(bowlNext({ kind: 'single' }).runs).toBe(1);
    expect(bowlNext({ kind: 'four' }).runs).toBe(5);
    const afterSix = bowlNext({ kind: 'six' });
    expect(afterSix.runs).toBe(11);
    expect(afterSix.extras).toBe(0);
    expect(afterSix.legalBalls).toBe(4);
    expect(afterSix.batters.some((batter) => batter.fours === 1)).toBe(true);
    expect(afterSix.batters.some((batter) => batter.sixes === 1)).toBe(true);
  });

  it('does not count wides or no-balls as legal deliveries and keeps extras off the batter', () => {
    resetSimulator();
    const wide = bowlNext({ kind: 'wide' });
    expect(wide.legalBalls).toBe(0);
    expect(wide.overs).toBe('0.0');
    expect(wide.extras).toBe(1);
    expect(wide.batters).toEqual([]);
    expect(wide.bowlers[0].runs).toBe(1);
    const noball = bowlNext({ kind: 'noball' });
    expect(noball.legalBalls).toBe(0);
    expect(noball.extras).toBe(2);
    expect(noball.runs).toBe(2);
    const dot = bowlNext({ kind: 'dot' });
    expect(dot.legalBalls).toBe(1);
    expect(dot.overs).toBe('0.1');
  });

  it('counts wickets and brings in the next batter', () => {
    resetSimulator();
    const after = bowlNext({ kind: 'wicket' });
    expect(after.wickets).toBe(1);
    expect(after.striker).toBe('C. Rahul');
    expect(after.bowlers[0].wickets).toBe(1);
    expect(after.legalBalls).toBe(1);
  });

  it('changes strike for an odd run and again when the over is completed', () => {
    resetSimulator();
    for (let ball = 0; ball < 5; ball += 1) bowlNext({ kind: 'dot' });
    expect(getSimulatorMatch().striker).toBe('A. Sharma');
    const end = bowlNext({ kind: 'single' });
    expect(end.overs).toBe('1.0');
    expect(end.legalBalls).toBe(6);
    expect(end.striker).toBe('A. Sharma');
    expect(end.bowler).toBe('N. Cummins');
  });

  it('finishes the innings at the over limit and rejects another ball', () => {
    resetSimulator({ maxOvers: 1, maxWickets: 10, seed: 1 });
    for (let ball = 0; ball < 6; ball += 1) bowlNext({ kind: 'dot' });
    expect(getSimulatorMatch().status).toBe('innings complete');
    expect(() => bowlNext({ kind: 'dot' })).toThrowError(AppError);
    try {
      bowlNext({ kind: 'dot' });
    } catch (error) {
      expect(error).toMatchObject({ status: 409, code: 'INNINGS_COMPLETE' });
    }
  });

  it('finishes the innings at the wicket limit', () => {
    resetSimulator({ maxOvers: 20, maxWickets: 2, seed: 1 });
    bowlNext({ kind: 'wicket' });
    bowlNext({ kind: 'wicket' });
    expect(getSimulatorMatch().status).toBe('innings complete');
    expect(getSimulatorMatch().wickets).toBe(2);
  });

  it('reproduces a seeded random delivery', () => {
    const first = resetSimulator({ seed: 99 });
    bowlNext({ random: true });
    const kind = getSimulatorMatch().deliveries[0].kind;
    resetSimulator({ seed: 99 });
    expect(first.deliveries).toEqual([]);
    bowlNext({ random: true });
    expect(getSimulatorMatch().deliveries[0].kind).toBe(kind);
  });
});

describe('cricket provider', () => {
  it('rejects an invalid match id before calling the provider', async () => {
    process.env.CRICKET_API_KEY = 'test-key';
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(getCommentary('abc')).rejects.toMatchObject({ status: 400, code: 'INVALID_MATCH_ID' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a missing API key', async () => {
    delete process.env.CRICKET_API_KEY;
    await expect(getLiveMatches()).rejects.toMatchObject({ status: 503, code: 'CRICKET_API_KEY_MISSING' });
  });

  it('maps a timeout and an HTTP error without inventing a score', async () => {
    process.env.CRICKET_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(Object.assign(new Error('slow'), { name: 'TimeoutError' }))));
    await expect(getLiveMatches()).rejects.toMatchObject({ status: 504, code: 'PROVIDER_TIMEOUT' });

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ status: 'error', message: 'down' }, 500)));
    await expect(getLiveMatches()).rejects.toMatchObject({ status: 502, code: 'PROVIDER_ERROR' });

    vi.stubGlobal('fetch', vi.fn(async () => new Response('not-json', { status: 200 })));
    await expect(getLiveMatches()).rejects.toMatchObject({
      status: 502,
      code: 'PROVIDER_INVALID_JSON',
      message: expect.stringContaining('HTTP 200'),
    });
  });

  it('includes a short preview for HTML and empty bodies', async () => {
    process.env.CRICKET_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html><h1>404 Not Found test-key</h1></html>', { status: 200 })));
    const html = await getLiveMatches().catch((error: unknown) => error);
    expect(html).toMatchObject({ status: 502, code: 'PROVIDER_INVALID_JSON' });
    expect((html as AppError).message).toContain('HTTP 200');
    expect((html as AppError).message).toContain('404 Not Found');
    expect((html as AppError).message).not.toContain('test-key');

    vi.stubGlobal('fetch', vi.fn(async () => new Response('   ', { status: 200 })));
    await expect(getLiveMatches()).rejects.toMatchObject({
      status: 502,
      code: 'PROVIDER_INVALID_JSON',
      message: expect.stringContaining('(empty body)'),
    });
  });

  it('keeps HTTP 401, 403, 404, and 5xx separate from invalid JSON', async () => {
    process.env.CRICKET_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'Unauthenticated.' }, 401)));
    await expect(getLiveMatches()).rejects.toMatchObject({ status: 502, code: 'PROVIDER_UNAUTHORIZED', message: expect.stringContaining('HTTP 401') });

    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ message: 'Forbidden.' }, 403)));
    await expect(getLiveMatches()).rejects.toMatchObject({ status: 502, code: 'PROVIDER_FORBIDDEN', message: expect.stringContaining('HTTP 403') });

    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html><h1>404 Not Found</h1></html>', { status: 404 })));
    await expect(getLiveMatches()).rejects.toMatchObject({ status: 404, code: 'MATCH_NOT_FOUND', message: expect.stringContaining('HTTP 404') });

    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html><h1>Bad gateway</h1></html>', { status: 502 })));
    await expect(getLiveMatches()).rejects.toMatchObject({ status: 502, code: 'PROVIDER_ERROR', message: expect.stringContaining('HTTP 502') });
  });

  it('calls CricketData current matches with the key in the query string', async () => {
    process.env.CRICKET_API_KEY = 'test-key';
    const fetchMock = vi.fn(async () => jsonResponse({ status: 'success', data: [] }));
    vi.stubGlobal('fetch', fetchMock);
    await getLiveMatches();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.cricapi.com/v1/currentMatches?offset=0&apikey=test-key');
    expect(new Headers(init.headers).get('Authorization')).toBeNull();
  });

  it('treats a CricketData failure status as an invalid key', async () => {
    process.env.CRICKET_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ status: 'failure', reason: 'Invalid API Key' })));
    await expect(getLiveMatches()).rejects.toMatchObject({ status: 502, code: 'PROVIDER_UNAUTHORIZED' });
  });

  it('returns 429 when rate limited and serves the previous payload as delayed', async () => {
    process.env.CRICKET_API_KEY = 'test-key';
    process.env.CRICKET_POLL_INTERVAL_MS = '1';
    const live = { status: 'success', data: [{ id: '189a5631-8bae-4d2f-8a21-3d31219b1bc2', name: 'India vs Australia', score: [{ r: 10, w: 0, o: 1.2, inning: 'India Inning 1' }] }] };
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(live)));
    const first = await getLiveMatches();
    expect(first.source).toBe('provider');
    expect(first.data).toEqual(live);

    await new Promise((resolve) => setTimeout(resolve, 5));
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ status: 'error', message: 'Monthly quota exceeded.' }, 429)));
    const delayed = await getLiveMatches();
    expect(delayed.delayed).toBe(true);
    expect(delayed.stale).toBe(true);
    expect(delayed.data).toEqual(live);

    clearCricketCache();
    await expect(getLiveMatches()).rejects.toMatchObject({ status: 429, code: 'PROVIDER_RATE_LIMITED' });
    delete process.env.CRICKET_POLL_INTERVAL_MS;
  });

  it('keeps provider data separate from the simulator and normalizes a match score', async () => {
    process.env.CRICKET_API_KEY = 'test-key';
    const matchId = '189a5631-8bae-4d2f-8a21-3d31219b1bc2';
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({
          status: 'success',
          data: {
            id: matchId,
            name: 'Sri Lanka vs New Zealand',
            status: 'Rain stops play',
            dateTimeGMT: '2024-11-19T09:00:00',
            teams: ['Sri Lanka', 'New Zealand'],
            score: [{ r: 112, w: 1, o: 21, inning: 'New Zealand Inning 1' }],
          },
        }),
      ),
    );
    const score = await getScore(matchId);
    expect(score.source).toBe('provider');
    expect(score.provider).toBe('cricapi');
    expect(score.delayed).toBe(true);
    expect(getSimulatorMatch().source).toBe('simulator');
    expect(score.normalized?.match).toMatchObject({
      id: matchId,
      status: 'Rain stops play',
      score: 'New Zealand Inning 1: 112/1 (21)',
      startTime: '2024-11-19T09:00:00',
    });
  });

  it('reuses a cached response, resets the quota on the next UTC day, and blocks only at the cap', async () => {
    process.env.CRICKET_API_KEY = 'test-key';
    process.env.CRICKET_API_DAILY_HIT_CAP = '1';
    process.env.CRICKET_POLL_INTERVAL_MS = '60000';
    let now = new Date('2026-10-17T18:00:00.000Z');
    setCricketClock(() => now);
    const fetchMock = vi.fn(async () => jsonResponse({ status: 'success', data: [], info: { hitsToday: 1, hitsLimit: 100 } }));
    vi.stubGlobal('fetch', fetchMock);

    const first = await getLiveMatches();
    const second = await getLiveMatches();
    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now = new Date('2026-10-17T18:02:00.000Z');
    await expect(getLiveMatches()).resolves.toMatchObject({ stale: true, delayed: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    now = new Date('2026-10-18T00:00:00.000Z');
    await expect(getLiveMatches()).resolves.toMatchObject({ source: 'provider' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('stops new provider calls once the reported daily usage reaches the cap', async () => {
    process.env.CRICKET_API_KEY = 'test-key';
    process.env.CRICKET_API_DAILY_HIT_CAP = '1';
    const fetchMock = vi.fn(async () => jsonResponse({ status: 'failure', reason: 'Invalid API Key', info: { hitsToday: 1, hitsLimit: 100 } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getLiveMatches()).rejects.toMatchObject({ status: 502, code: 'PROVIDER_UNAUTHORIZED' });
    await expect(getLiveMatches()).rejects.toMatchObject({ status: 429, code: 'PROVIDER_RATE_LIMITED' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not count a timeout toward the daily cap and shares one in-flight request', async () => {
    process.env.CRICKET_API_KEY = 'test-key';
    process.env.CRICKET_API_DAILY_HIT_CAP = '1';
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(Object.assign(new Error('slow'), { name: 'TimeoutError' }))));
    await expect(getLiveMatches()).rejects.toMatchObject({ status: 504, code: 'PROVIDER_TIMEOUT' });

    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchMock = vi.fn(async () => {
      await gate;
      return jsonResponse({ status: 'success', data: [], info: { hitsToday: 0, hitsLimit: 100 } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const pending = Promise.all([getLiveMatches(), getLiveMatches()]);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    release();
    const [left, right] = await pending;
    expect(left.source).toBe('provider');
    expect(right).toBe(left);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('emits cricket.updated for a validated score and skips an unchanged cached response', async () => {
    process.env.CRICKET_API_KEY = 'test-key';
    const emit = vi.spyOn(hub, 'emitAll').mockImplementation(() => undefined);
    const live = { status: 'success', data: [{ id: '189a5631-8bae-4d2f-8a21-3d31219b1bc2', name: 'India vs Australia', status: 'live', score: [{ r: 10, w: 1, o: 1.2, inning: 'India Inning 1' }] }] };
    const fetchMock = vi.fn(async () => jsonResponse(live));
    vi.stubGlobal('fetch', fetchMock);
    await getLiveMatches();
    expect(emit).toHaveBeenCalledWith('cricket.updated', 0, expect.objectContaining({
      matchId: '189a5631-8bae-4d2f-8a21-3d31219b1bc2',
      runs: 10,
      wickets: 1,
      overs: 1.2,
      provider: 'cricapi',
    }));
    emit.mockClear();
    await getLiveMatches();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(emit).not.toHaveBeenCalled();
    emit.mockRestore();
  });

  it('does not emit when the provider response is invalid or the daily cap blocks the request', async () => {
    process.env.CRICKET_API_KEY = 'test-key';
    const emit = vi.spyOn(hub, 'emitAll').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200 })));
    await expect(getLiveMatches()).rejects.toMatchObject({ code: 'PROVIDER_INVALID_JSON' });
    expect(emit).not.toHaveBeenCalled();

    clearCricketCache();
    process.env.CRICKET_API_DAILY_HIT_CAP = '1';
    const fetchMock = vi.fn(async () => jsonResponse({ status: 'failure', reason: 'Invalid API Key', info: { hitsToday: 1, hitsLimit: 100 } }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getLiveMatches()).rejects.toMatchObject({ code: 'PROVIDER_UNAUTHORIZED' });
    expect(emit).not.toHaveBeenCalled();
    fetchMock.mockClear();
    await expect(getLiveMatches()).rejects.toMatchObject({ code: 'PROVIDER_RATE_LIMITED' });
    expect(fetchMock).not.toHaveBeenCalled();
    emit.mockRestore();
  });

  it('redacts the CricketData key from logged request URLs', () => {
    const logged = redactProviderUrl('https://api.cricapi.com/v1/currentMatches?offset=0&apikey=secret-key');
    expect(logged).not.toContain('secret-key');
    expect(logged).toContain('apikey=redacted');
  });
});

describe('cricket routes', () => {
  it('requires a CricketData match id and keeps the simulator off the provider path', async () => {
    const { user } = await createUserWithWallet();
    const token = await loginToken(user.email);
    const invalid = await api().get('/api/v1/cricket/not-a-match/commentary').set(bearer(token));
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('INVALID_MATCH_ID');

    const simulator = await api().get('/api/v1/cricket/test/match').set(bearer(token));
    expect(simulator.status).toBe(200);
    expect(simulator.body.source).toBe('simulator');
    expect(simulator.body.simulated).toBe(true);
  });
});
