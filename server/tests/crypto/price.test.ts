import { afterEach, describe, expect, it, vi } from 'vitest';

import { getBybitTicker } from '../../src/modules/crypto/bybit.service';
import * as hub from '../../src/realtime/hub';
import { runCryptoTick } from '../../src/workers/cryptoFeed';
import { api, bearer, loginToken } from '../helpers/app';
import { prisma } from '../helpers/db';
import { createUserWithWallet } from '../helpers/factories';

function tickerResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const liveTicker = tickerResponse({
  retCode: 0,
  result: { list: [{ symbol: 'BTCUSDT', lastPrice: '83681.4', price24hPcnt: '0.0073', volume24h: '10' }] },
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('BTC price', () => {
  it('reads the Bybit BTCUSDT spot ticker', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => liveTicker.clone()));
    const ticker = await getBybitTicker('btcusdt');
    expect(ticker).toMatchObject({ symbol: 'BTCUSDT', lastPrice: '83681.4', price24hPcnt: '0.0073' });
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe('https://api.bybit.com/v5/market/tickers?category=spot&symbol=BTCUSDT');
  });

  it('rejects a rate limit, an invalid price, and a provider error', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('slow down', { status: 429 })));
    await expect(getBybitTicker('BTCUSDT')).rejects.toMatchObject({ status: 502, code: 'BYBIT_UNAVAILABLE' });

    vi.stubGlobal('fetch', vi.fn(async () => tickerResponse({ retCode: 0, result: { list: [{ symbol: 'BTCUSDT', lastPrice: '0' }] } })));
    await expect(getBybitTicker('BTCUSDT')).rejects.toMatchObject({ code: 'BYBIT_UNAVAILABLE' });

    vi.stubGlobal('fetch', vi.fn(async () => tickerResponse({ retCode: 10001, retMsg: 'bad' })));
    await expect(getBybitTicker('BTCUSDT')).rejects.toMatchObject({ code: 'BYBIT_UNAVAILABLE' });
  });

  it('returns the live price, and marks the last stored price stale when Bybit is down', async () => {
    const { user } = await createUserWithWallet();
    const token = await loginToken(user.email);
    const asOf = new Date(Date.now() - 60_000);
    await prisma.priceHistory.create({ data: { symbol: 'BTC', timestamp: asOf, price: 100 } });

    vi.stubGlobal('fetch', vi.fn(async () => liveTicker.clone()));
    const live = await api().get('/api/v1/crypto/BTC/price-history?timeframe=24H').set(bearer(token));
    expect(live.status).toBe(200);
    expect(live.body.currentPrice).toBe(83681.4);
    expect(live.body.changePercent).toBeCloseTo(0.73);
    expect(live.body.stale).toBe(false);
    expect(live.body.points.at(-1).price).toBe(83681.4);

    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new Error('offline'))));
    const delayed = await api().get('/api/v1/crypto/BTC/price-history?timeframe=24H').set(bearer(token));
    expect(delayed.status).toBe(200);
    expect(delayed.body.currentPrice).toBe(100);
    expect(delayed.body.stale).toBe(true);
    expect(delayed.body.asOf).toBe(asOf.getTime());
    expect(delayed.body.points.at(-1).price).toBe(100);
  });

  it('retries a network failure once and then accepts a positive price', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(liveTicker.clone());
    vi.stubGlobal('fetch', fetchMock);
    await expect(getBybitTicker('BTCUSDT')).resolves.toMatchObject({ lastPrice: '83681.4' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('bounds timeout and HTTP 429 retries', async () => {
    process.env.BYBIT_MAX_ATTEMPTS = '2';
    const timedOut = vi.fn(async () => Promise.reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' })));
    vi.stubGlobal('fetch', timedOut);
    await expect(getBybitTicker('BTCUSDT')).rejects.toMatchObject({ code: 'BYBIT_UNAVAILABLE', details: { category: 'timeout' } });
    expect(timedOut).toHaveBeenCalledTimes(2);

    const limited = vi.fn(async () => new Response('slow down', { status: 429 }));
    vi.stubGlobal('fetch', limited);
    await expect(getBybitTicker('BTCUSDT')).rejects.toMatchObject({ details: { category: 'http', status: 429 } });
    expect(limited).toHaveBeenCalledTimes(2);
    delete process.env.BYBIT_MAX_ATTEMPTS;
  });

  it('rejects invalid JSON, a provider error code, and a non-positive price without retrying', async () => {
    const invalidJson = vi.fn(async () => new Response('not-json', { status: 200, headers: { 'content-type': 'application/json' } }));
    vi.stubGlobal('fetch', invalidJson);
    await expect(getBybitTicker('BTCUSDT')).rejects.toMatchObject({ details: { category: 'invalid_json' } });
    expect(invalidJson).toHaveBeenCalledTimes(1);

    const badCode = vi.fn(async () => tickerResponse({ retCode: 10001, retMsg: 'bad' }));
    vi.stubGlobal('fetch', badCode);
    await expect(getBybitTicker('BTCUSDT')).rejects.toMatchObject({ details: { category: 'provider_code' } });
    expect(badCode).toHaveBeenCalledTimes(1);

    for (const lastPrice of ['0', '-1', 'NaN']) {
      const badPrice = vi.fn(async () => tickerResponse({ retCode: 0, result: { list: [{ symbol: 'BTCUSDT', lastPrice }] } }));
      vi.stubGlobal('fetch', badPrice);
      await expect(getBybitTicker('BTCUSDT')).rejects.toMatchObject({ details: { category: 'invalid_price' } });
      expect(badPrice).toHaveBeenCalledTimes(1);
    }
  });

  it('emits a persisted CoinGecko price when Bybit fails and skips an unchanged price', async () => {
    process.env.BYBIT_MAX_ATTEMPTS = '1';
    const emit = vi.spyOn(hub, 'emitAll').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes('bybit.com')) throw new TypeError('fetch failed');
      return new Response(JSON.stringify({ bitcoin: { usd: 111.5, usd_24h_change: 1 }, ethereum: { usd: 222.5, usd_24h_change: -1 } }), { status: 200 });
    }));
    await prisma.priceHistory.deleteMany({ where: { symbol: { in: ['BTC', 'ETH'] } } });
    await runCryptoTick();
    const stored = await prisma.priceHistory.findMany({ where: { symbol: 'BTC' } });
    expect(stored).toHaveLength(1);
    expect(emit).toHaveBeenCalledWith('crypto.updated', 1, expect.objectContaining({ symbol: 'BTCUSDT', price: 111.5, provider: 'coingecko' }));
    expect(emit.mock.calls.some((call) => call[0] === 'odds.updated')).toBe(false);

    emit.mockClear();
    await runCryptoTick();
    expect(await prisma.priceHistory.count({ where: { symbol: 'BTC' } })).toBe(1);
    expect(emit).not.toHaveBeenCalled();
    emit.mockRestore();
    delete process.env.BYBIT_MAX_ATTEMPTS;
  });

  it('does not emit a price when every provider fails', async () => {
    process.env.BYBIT_MAX_ATTEMPTS = '1';
    const emit = vi.spyOn(hub, 'emitAll').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))));
    await runCryptoTick();
    expect(emit).not.toHaveBeenCalled();
    emit.mockRestore();
    delete process.env.BYBIT_MAX_ATTEMPTS;
  });
});
