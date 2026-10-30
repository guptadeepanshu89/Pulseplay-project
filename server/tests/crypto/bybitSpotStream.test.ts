import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { parseBybitSpotTickerMessage } from '../../src/modules/crypto/bybitTickerParse';
import * as bybitStreamModule from '../../src/modules/crypto/bybitSpotStream';
import {
  bybitStreamIsFresh,
  resetBybitSpotStreamForTests,
  setBybitWsFactory,
  startBybitSpotStream,
  stopBybitSpotStream,
} from '../../src/modules/crypto/bybitSpotStream';
import { resetPublishedPricesForTests } from '../../src/modules/crypto/cryptoQuotes';
import * as hub from '../../src/realtime/hub';
import { runCryptoTick } from '../../src/workers/cryptoFeed';
import { prisma } from '../helpers/db';

class MockWebSocket extends EventEmitter {
  static OPEN = 1;
  static CONNECTING = 0;
  readyState = MockWebSocket.CONNECTING;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = 3;
    this.emit('close');
  });
  removeAllListeners(): this {
    return super.removeAllListeners();
  }
}

const spotTicker = (symbol: string, lastPrice: string, ts = 1_700_000_000_000) =>
  JSON.stringify({
    topic: `tickers.${symbol}`,
    type: 'snapshot',
    ts,
    data: { symbol, lastPrice, price24hPcnt: '0.01' },
  });

describe('Bybit spot WebSocket', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetPublishedPricesForTests();
    resetBybitSpotStreamForTests();
    vi.spyOn(hub, 'emitAll').mockImplementation(() => undefined);
  });

  afterEach(() => {
    stopBybitSpotStream();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('parses valid spot ticker snapshots and rejects invalid payloads', () => {
    expect(parseBybitSpotTickerMessage(spotTicker('BTCUSDT', '90000.5'))).toMatchObject({
      symbol: 'BTCUSDT',
      lastPrice: 90000.5,
    });
    expect(parseBybitSpotTickerMessage(spotTicker('ETHUSDT', '3000'))?.symbol).toBe('ETHUSDT');
    expect(parseBybitSpotTickerMessage(spotTicker('SOLUSDT', '100'))).toBeNull();
    expect(parseBybitSpotTickerMessage(spotTicker('BTCUSDT', '0'))).toBeNull();
    expect(parseBybitSpotTickerMessage(JSON.stringify({ op: 'pong', ret_msg: 'pong' }))).toBeNull();
  });

  it('subscribes to BTC and ETH on connect and emits crypto.updated', async () => {
    let created = 0;
    let socket: MockWebSocket | null = null;
    setBybitWsFactory(() => {
      created += 1;
      socket = new MockWebSocket();
      queueMicrotask(() => {
        socket!.readyState = MockWebSocket.OPEN;
        socket!.emit('open');
      });
      return socket as unknown as import('ws').default;
    });

    await prisma.priceHistory.deleteMany({ where: { symbol: { in: ['BTC', 'ETH'] } } });
    startBybitSpotStream();
    await vi.waitFor(() => expect(socket?.send).toHaveBeenCalled());

    const subscribePayload = JSON.parse(String(socket!.send.mock.calls[0][0])) as { op: string; args: string[] };
    expect(subscribePayload.op).toBe('subscribe');
    expect(subscribePayload.args).toEqual(['tickers.BTCUSDT', 'tickers.ETHUSDT']);

    socket!.emit('message', spotTicker('BTCUSDT', '91000.1', 1_700_000_000_100));
    await vi.waitFor(() => expect(hub.emitAll).toHaveBeenCalled());
    expect(hub.emitAll).toHaveBeenCalledWith(
      'crypto.updated',
      1,
      expect.objectContaining({ symbol: 'BTCUSDT', price: 91000.1, provider: 'bybit' }),
    );
    expect(created).toBe(1);
  });

  it('reconnects with backoff after disconnect and resubscribes', async () => {
    const sockets: MockWebSocket[] = [];
    setBybitWsFactory(() => {
      const socket = new MockWebSocket();
      sockets.push(socket);
      queueMicrotask(() => {
        socket.readyState = MockWebSocket.OPEN;
        socket.emit('open');
      });
      return socket as unknown as import('ws').default;
    });

    startBybitSpotStream();
    await vi.waitFor(() => expect(sockets.length).toBe(1));
    sockets[0].emit('close');
    await vi.advanceTimersByTimeAsync(1_500);
    await vi.waitFor(() => expect(sockets.length).toBe(2));
    expect(sockets[1].send).toHaveBeenCalled();
  });

  it('marks stream fresh only after a recent tick', () => {
    expect(bybitStreamIsFresh()).toBe(false);
  });

  it('uses REST fallback for BTC when the stream is unavailable and does not fabricate prices', async () => {
    vi.useRealTimers();
    resetBybitSpotStreamForTests();
    const emit = vi.spyOn(hub, 'emitAll').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL | Request) => {
        const target = String(url);
        if (target.includes('bybit.com')) {
          return new Response(
            JSON.stringify({
              retCode: 0,
              result: { list: [{ symbol: 'BTCUSDT', lastPrice: '50000', price24hPcnt: '0.01' }] },
            }),
            { status: 200, headers: { 'content-type': 'application/json' } },
          );
        }
        throw new TypeError('offline');
      }),
    );
    process.env.BYBIT_MAX_ATTEMPTS = '1';
    await prisma.priceHistory.deleteMany({ where: { symbol: 'BTC' } });
    await runCryptoTick();
    expect(emit).toHaveBeenCalledWith('crypto.updated', 1, expect.objectContaining({ price: 50000 }));
    emit.mockClear();
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('offline'))));
    await runCryptoTick();
    expect(emit).not.toHaveBeenCalled();
    delete process.env.BYBIT_MAX_ATTEMPTS;
    vi.unstubAllGlobals();
  });

  it('does not REST-publish BTC/ETH when the live stream is fresh', async () => {
    vi.useRealTimers();
    vi.spyOn(bybitStreamModule, 'bybitStreamIsFresh').mockReturnValue(true);
    const emit = vi.spyOn(hub, 'emitAll').mockImplementation(() => undefined);
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes('bybit.com') && target.includes('BTCUSDT')) {
        return new Response(
          JSON.stringify({ retCode: 0, result: { list: [{ symbol: 'BTCUSDT', lastPrice: '99999', price24hPcnt: '0' }] } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (target.includes('bybit.com') && target.includes('ETHUSDT')) {
        return new Response(
          JSON.stringify({ retCode: 0, result: { list: [{ symbol: 'ETHUSDT', lastPrice: '8888', price24hPcnt: '0' }] } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      throw new TypeError('offline');
    });
    vi.stubGlobal('fetch', fetchMock);
    process.env.BYBIT_MAX_ATTEMPTS = '1';
    await runCryptoTick();
    expect(emit).not.toHaveBeenCalledWith('crypto.updated', 1, expect.anything());
    expect(emit).not.toHaveBeenCalledWith('crypto.updated', 2, expect.anything());
    delete process.env.BYBIT_MAX_ATTEMPTS;
    vi.unstubAllGlobals();
  });
});
