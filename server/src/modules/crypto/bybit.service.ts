import { AppError } from '../../core/errors';

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_ATTEMPTS = 3;
const SUPPORTED_SYMBOLS = new Set(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);

export interface BybitTicker {
  symbol: string;
  lastPrice: string;
  price24hPcnt: string;
  volume24h: string;
}

export type BybitFailureCategory = 'network' | 'timeout' | 'http' | 'invalid_json' | 'provider_code' | 'invalid_price';

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

function timeoutMs(): number {
  const parsed = Number(process.env.BYBIT_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function maxAttempts(): number {
  const parsed = Number(process.env.BYBIT_MAX_ATTEMPTS ?? DEFAULT_ATTEMPTS);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : DEFAULT_ATTEMPTS;
}

function unavailable(category: BybitFailureCategory): AppError {
  return new AppError(502, 'BYBIT_UNAVAILABLE', 'Market data is temporarily unavailable', { category });
}

export function normalizeBybitSymbol(symbol: string): string {
  const normalized = symbol.trim().toUpperCase();
  if (!SUPPORTED_SYMBOLS.has(normalized)) {
    throw new AppError(400, 'INVALID_SYMBOL', 'Unsupported symbol');
  }
  return normalized;
}

export function bybitFailureCategory(error: unknown, status?: number): BybitFailureCategory {
  if (status === 429 || (typeof status === 'number' && status >= 500)) return 'http';
  if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) return 'timeout';
  return 'network';
}

function causeLabel(error: unknown): string {
  const cause = error instanceof Error ? (error as Error & { cause?: { code?: string; message?: string } }).cause : undefined;
  return cause?.code ?? (error instanceof Error ? error.name : 'error');
}

function detail(error: AppError, key: string): unknown {
  if (!error.details || typeof error.details !== 'object') return undefined;
  return (error.details as Record<string, unknown>)[key];
}

function retryable(category: unknown, status?: number): boolean {
  if (category !== 'network' && category !== 'timeout' && category !== 'http') return false;
  if (category === 'network' || category === 'timeout') return true;
  return category === 'http' && (status === 429 || (typeof status === 'number' && status >= 500));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getBybitTicker(symbol: string): Promise<BybitTicker> {
  const normalized = normalizeBybitSymbol(symbol);
  const url = `${baseUrl()}/v5/market/tickers?category=spot&symbol=${normalized}`;
  const attempts = maxAttempts();
  let lastError: AppError = unavailable('network');

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await requestTicker(url, normalized, attempt);
    } catch (error) {
      lastError = error instanceof AppError ? error : unavailable('network');
      const category = detail(lastError, 'category');
      const statusValue = detail(lastError, 'status');
      const status = typeof statusValue === 'number' ? statusValue : undefined;
      if (!retryable(category, status) || attempt === attempts) throw lastError;
      await wait(200 * attempt);
    }
  }

  throw lastError;
}

async function requestTicker(url: string, symbol: string, attempt: number): Promise<BybitTicker> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs()) });
  } catch (error) {
    const category = bybitFailureCategory(error);
    console.warn(`[bybit] ${symbol} ${category} attempt=${attempt} cause=${causeLabel(error)}`);
    throw unavailable(category);
  }

  if (response.status === 429 || response.status >= 500) {
    console.warn(`[bybit] ${symbol} http attempt=${attempt} status=${response.status}`);
    throw new AppError(502, 'BYBIT_UNAVAILABLE', 'Market data is temporarily unavailable', { category: 'http', status: response.status });
  }

  if (!response.ok) {
    console.warn(`[bybit] ${symbol} http attempt=${attempt} status=${response.status}`);
    throw new AppError(502, 'BYBIT_UNAVAILABLE', 'Market data is temporarily unavailable', { category: 'http', status: response.status });
  }

  let body: BybitTickersResponse;
  try {
    body = (await response.json()) as BybitTickersResponse;
  } catch {
    console.warn(`[bybit] ${symbol} invalid_json attempt=${attempt}`);
    throw unavailable('invalid_json');
  }

  if (body.retCode !== 0) {
    console.warn(`[bybit] ${symbol} provider_code attempt=${attempt} retCode=${body.retCode ?? 'missing'}`);
    throw unavailable('provider_code');
  }

  const row = body.result?.list?.[0];
  const lastPrice = Number(row?.lastPrice);
  if (!row?.lastPrice || row.symbol !== symbol || !Number.isFinite(lastPrice) || lastPrice <= 0) {
    console.warn(`[bybit] ${symbol} invalid_price attempt=${attempt}`);
    throw unavailable('invalid_price');
  }

  return {
    symbol,
    lastPrice: row.lastPrice,
    price24hPcnt: row.price24hPcnt ?? '',
    volume24h: row.volume24h ?? '',
  };
}
