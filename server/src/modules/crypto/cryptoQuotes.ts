import { prisma } from '../../db';
import { emitAll } from '../../realtime/hub';
import { safeError } from '../../realtime/runtime';
import { writeCryptoChangePercent24h } from './cryptoEventStore';

export const CRYPTO_ENTITY_ID: Record<string, number> = { BTCUSDT: 1, ETHUSDT: 2, SOLUSDT: 3 };

export const CHART_SYMBOL_BY_MARKET: Record<string, string> = {
  BTCUSDT: 'BTC',
  ETHUSDT: 'ETH',
  SOLUSDT: 'SOL',
};

export interface SpotQuote {
  symbol: string;
  marketSymbol: string;
  price: number;
  changePercent24h?: number;
  provider: 'bybit' | 'coingecko';
}

const lastPublishedPrice = new Map<string, number>();

export function resetPublishedPricesForTests(): void {
  lastPublishedPrice.clear();
}

/** Persist when price moved, update event 24h change, optionally emit Socket.IO. Returns true if price changed. */
export async function ingestSpotQuote(quote: SpotQuote, asOf: Date, emit: boolean): Promise<boolean> {
  const { symbol, marketSymbol, price, changePercent24h, provider } = quote;
  if (!Number.isFinite(price) || price <= 0) return false;

  const lastPoint = await prisma.priceHistory.findFirst({ where: { symbol }, orderBy: { timestamp: 'desc' } });
  const changed = !lastPoint || !lastPoint.price.equals(price);
  if (!changed) return false;

  await prisma.priceHistory.create({ data: { symbol, timestamp: asOf, price } });

  if (emit) {
    const previous = lastPublishedPrice.get(marketSymbol);
    if (previous !== price) {
      publishCrypto({ symbol, marketSymbol, price, changePercent24h, provider }, asOf);
      lastPublishedPrice.set(marketSymbol, price);
    }
  }

  if (typeof changePercent24h === 'number') {
    try {
      await writeCryptoChangePercent24h(symbol, changePercent24h);
    } catch (error) {
      console.warn(`[crypto] changePercent24h update skipped for ${symbol}: ${safeError(error)}`);
    }
  }

  return true;
}

export function publishCrypto(quote: SpotQuote, asOf: Date): void {
  const entityId = CRYPTO_ENTITY_ID[quote.marketSymbol];
  if (!entityId || !Number.isFinite(quote.price) || quote.price <= 0) return;
  try {
    emitAll('crypto.updated', entityId, {
      symbol: quote.marketSymbol,
      price: quote.price,
      provider: quote.provider,
      asOf: asOf.toISOString(),
    });
  } catch (error) {
    console.warn(`[crypto] socket emit skipped for ${quote.marketSymbol}: ${safeError(error)}`);
  }
}

export const PRICE_HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export async function prunePriceHistory(now = new Date()): Promise<void> {
  await prisma.priceHistory.deleteMany({
    where: { timestamp: { lt: new Date(now.getTime() - PRICE_HISTORY_RETENTION_MS) } },
  });
}
