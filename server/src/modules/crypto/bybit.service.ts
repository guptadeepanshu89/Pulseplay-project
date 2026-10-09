import { AppError } from '../../core/errors';

const TIMEOUT_MS = 8000;
const SUPPORTED_SYMBOLS = new Set(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);

export interface BybitTicker {
  symbol: string;
  lastPrice: string;
  price24hPcnt: string;
  volume24h: string;
}

interface BybitTickerRow {
  symbol?: string;
  lastPrice?: string;
  price24hPcnt?: string;
  volume24h?: string;
}

interface BybitTickersResponse {
  retCode?: number;
  retMsg?: string;
  result?: { list?: BybitTickerRow[] };
}

function baseUrl(): string {
  return (process.env.BYBIT_BASE_URL ?? 'https://api.bybit.com').replace(/\/$/, '');
}

function unavailable(): AppError {
  return new AppError(502, 'BYBIT_UNAVAILABLE', 'Market data is temporarily unavailable');
}

export function normalizeBybitSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!SUPPORTED_SYMBOLS.has(normalized)) {
    throw new AppError(400, 'INVALID_SYMBOL', 'Unsupported symbol');
  }
  return normalized;
}

export async function getBybitTicker(symbol: string): Promise<BybitTicker> {
  const normalized = normalizeBybitSymbol(symbol);
  const url = `${baseUrl()}/v5/market/tickers?category=spot&symbol=${normalized}`;

  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[bybit] request failed for ${normalized}: ${reason}`);
    throw unavailable();
  }

  if (!response.ok) {
    console.warn(`[bybit] HTTP ${response.status} for ${normalized}`);
    throw unavailable();
  }

  let body: BybitTickersResponse;
  try {
    body = (await response.json()) as BybitTickersResponse;
  } catch {
    console.warn(`[bybit] invalid JSON for ${normalized}`);
    throw unavailable();
  }

  if (body.retCode !== 0) {
    console.warn(`[bybit] retCode ${body.retCode ?? 'missing'} ${body.retMsg ?? ''} for ${normalized}`);
    throw unavailable();
  }

  const row = body.result?.list?.[0];
  if (!row?.lastPrice || row.symbol !== normalized) {
    console.warn(`[bybit] empty ticker for ${normalized}`);
    throw unavailable();
  }

  return {
    symbol: normalized,
    lastPrice: row.lastPrice,
    price24hPcnt: row.price24hPcnt ?? '',
    volume24h: row.volume24h ?? '',
  };
}
