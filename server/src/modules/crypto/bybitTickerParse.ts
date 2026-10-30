const STREAM_SYMBOLS = new Set(['BTCUSDT', 'ETHUSDT']);

export interface ParsedSpotTick {
  symbol: string;
  lastPrice: number;
  price24hPcnt?: number;
  providerTs?: number;
}

/** Parse Bybit v5 public spot ticker WebSocket payload (snapshot; field `lastPrice`). */
export function parseBybitSpotTickerMessage(raw: string): ParsedSpotTick | null {
  let message: Record<string, unknown>;
  try {
    message = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }

  const op = message.op;
  if (op === 'ping' || op === 'pong' || op === 'subscribe' || op === 'unsubscribe') return null;
  if (message.success === true && op === 'ping') return null;

  const topic = message.topic;
  if (typeof topic !== 'string' || !topic.startsWith('tickers.')) return null;

  const data = message.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;

  const symbol = String(row.symbol ?? topic.slice('tickers.'.length)).trim().toUpperCase();
  if (!STREAM_SYMBOLS.has(symbol)) return null;

  const lastPrice = Number(row.lastPrice);
  if (!Number.isFinite(lastPrice) || lastPrice <= 0) return null;

  const changeRatio = Number(row.price24hPcnt);
  const providerTs = typeof message.ts === 'number' && Number.isFinite(message.ts) ? message.ts : undefined;

  return {
    symbol,
    lastPrice,
    price24hPcnt: Number.isFinite(changeRatio) ? changeRatio : undefined,
    providerTs,
  };
}
