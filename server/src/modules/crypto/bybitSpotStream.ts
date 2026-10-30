import WebSocket from 'ws';

import { parseBybitSpotTickerMessage } from './bybitTickerParse';
import { CHART_SYMBOL_BY_MARKET, ingestSpotQuote, type SpotQuote } from './cryptoQuotes';
import { noteProvider, safeError, workersAcceptTicks } from '../../realtime/runtime';

const DEFAULT_WS_URL = 'wss://stream.bybit.com/v5/public/spot';
const TICKER_TOPICS = ['tickers.BTCUSDT', 'tickers.ETHUSDT'] as const;
const PING_INTERVAL_MS = 20_000;
const STREAM_STALE_MS = Number(process.env.BYBIT_WS_STALE_MS ?? 45_000);
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

export type WsFactory = (url: string) => WebSocket;

let ws: WebSocket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;
let intentionalClose = false;
let connecting = false;
let connected = false;
let lastMessageAt: number | null = null;
let lastTickAt: number | null = null;
let wsFactory: WsFactory = (url) => new WebSocket(url);

export function setBybitWsFactory(factory: WsFactory): void {
  wsFactory = factory;
}

export function bybitStreamStatus(now = Date.now()): {
  connected: boolean;
  fresh: boolean;
  lastMessageAt: string | null;
  lastTickAt: string | null;
} {
  const fresh =
    connected &&
    lastTickAt !== null &&
    now - lastTickAt <= STREAM_STALE_MS;
  return {
    connected,
    fresh,
    lastMessageAt: lastMessageAt ? new Date(lastMessageAt).toISOString() : null,
    lastTickAt: lastTickAt ? new Date(lastTickAt).toISOString() : null,
  };
}

export function bybitStreamIsFresh(now = Date.now()): boolean {
  return bybitStreamStatus(now).fresh;
}

function wsUrl(): string {
  return (process.env.BYBIT_WS_URL ?? DEFAULT_WS_URL).replace(/\/$/, '');
}

function clearPing(): void {
  if (pingTimer) {
    clearInterval(pingTimer);
    pingTimer = null;
  }
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(): void {
  if (intentionalClose || !workersAcceptTicks()) return;
  if (reconnectTimer) return;

  const jitter = Math.floor(Math.random() * 400);
  const delay = Math.min(MAX_BACKOFF_MS, INITIAL_BACKOFF_MS * 2 ** reconnectAttempt) + jitter;
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function subscribe(socket: WebSocket): void {
  socket.send(
    JSON.stringify({
      op: 'subscribe',
      args: [...TICKER_TOPICS],
    }),
  );
}

function startPing(socket: WebSocket): void {
  clearPing();
  pingTimer = setInterval(() => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ op: 'ping' }));
    }
  }, PING_INTERVAL_MS);
}

async function handleTick(tick: ReturnType<typeof parseBybitSpotTickerMessage>): Promise<void> {
  if (!tick) return;
  const chartSymbol = CHART_SYMBOL_BY_MARKET[tick.symbol];
  if (!chartSymbol) return;

  const asOf = tick.providerTs ? new Date(tick.providerTs) : new Date();
  const quote: SpotQuote = {
    symbol: chartSymbol,
    marketSymbol: tick.symbol,
    price: tick.lastPrice,
    changePercent24h: tick.price24hPcnt !== undefined ? tick.price24hPcnt * 100 : undefined,
    provider: 'bybit',
  };

  // Only advance freshness after a successful ingest. Failures keep the prior
  // lastTickAt so bybitStreamIsFresh() can go stale and REST fallback resumes.
  try {
    await ingestSpotQuote(quote, asOf, true);
  } catch (error) {
    console.warn(`[bybit-ws] tick ingest failed: ${safeError(error)}`);
    return;
  }
  lastTickAt = asOf.getTime();
  noteProvider('crypto', 'ok', undefined, asOf);
}

function attachHandlers(socket: WebSocket): void {
  socket.on('open', () => {
    connecting = false;
    connected = true;
    reconnectAttempt = 0;
    subscribe(socket);
    startPing(socket);
    console.info(JSON.stringify({ scope: 'bybit-ws', event: 'connected', url: wsUrl() }));
  });

  socket.on('message', (data) => {
    lastMessageAt = Date.now();
    const raw = typeof data === 'string' ? data : data.toString('utf8');
    void handleTick(parseBybitSpotTickerMessage(raw)).catch((error) => {
      console.warn(`[bybit-ws] tick handling failed: ${safeError(error)}`);
    });
  });

  socket.on('close', () => {
    connected = false;
    connecting = false;
    clearPing();
    ws = null;
    noteProvider('crypto', 'error', new Error('websocket closed'));
    console.info(JSON.stringify({ scope: 'bybit-ws', event: 'closed', intentional: intentionalClose }));
    if (!intentionalClose) scheduleReconnect();
  });

  socket.on('error', (error) => {
    noteProvider('crypto', 'error', error);
    console.warn(`[bybit-ws] socket error: ${safeError(error)}`);
  });
}

function connect(): void {
  if (intentionalClose || !workersAcceptTicks()) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  if (connecting) return;

  connecting = true;
  try {
    const socket = wsFactory(wsUrl());
    ws = socket;
    attachHandlers(socket);
  } catch (error) {
    connecting = false;
    noteProvider('crypto', 'error', error);
    scheduleReconnect();
  }
}

export function startBybitSpotStream(): void {
  intentionalClose = false;
  connect();
}

export function stopBybitSpotStream(): void {
  intentionalClose = true;
  clearReconnectTimer();
  clearPing();
  if (ws) {
    ws.removeAllListeners();
    ws.close();
    ws = null;
  }
  connected = false;
  connecting = false;
}

/** Test-only reset of connection bookkeeping. */
export function resetBybitSpotStreamForTests(): void {
  stopBybitSpotStream();
  lastMessageAt = null;
  lastTickAt = null;
  reconnectAttempt = 0;
  intentionalClose = false;
}
