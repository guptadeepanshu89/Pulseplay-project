import type { CryptoPriceHistory } from '../types/crypto';

interface CricketMatchPatch {
  id: string;
  status: string;
  score: string | null;
}

export interface ProviderEvent {
  type: string;
  timestamp?: string;
  data?: Record<string, unknown>;
}

export function applyCryptoSpot(
  history: CryptoPriceHistory | null,
  event: ProviderEvent,
  chartSymbol: string,
): CryptoPriceHistory | null {
  if (event.type !== 'crypto.updated' || !history) return history;
  const symbol = event.data?.symbol;
  const price = event.data?.price;
  if (typeof symbol !== 'string' || !sameCryptoSymbol(symbol, chartSymbol)) return history;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return history;
  const asOf = eventTime(event);
  if (history.asOf && asOf && asOf <= history.asOf) return history;
  const previous = history.currentPrice;
  return {
    ...history,
    currentPrice: price,
    asOf: asOf || history.asOf,
    stale: false,
    changeAmount: previous > 0 ? history.changeAmount + (price - previous) : history.changeAmount,
  };
}

export function mergeCryptoHistory(current: CryptoPriceHistory | null, incoming: CryptoPriceHistory): CryptoPriceHistory {
  if (!current?.asOf || incoming.asOf == null || incoming.asOf >= current.asOf) return incoming;
  return { ...incoming, currentPrice: current.currentPrice, asOf: current.asOf, stale: false };
}

export function applyCricketUpdate<T extends CricketMatchPatch>(
  matches: T[],
  event: ProviderEvent,
  mode: 'provider' | 'simulator',
  seenAt: Map<string, number>,
): T[] {
  if (mode !== 'provider' || event.type !== 'cricket.updated') return matches;
  const matchId = event.data?.matchId;
  if (typeof matchId !== 'string') return matches;
  const asOf = eventTime(event);
  const previous = seenAt.get(matchId) ?? 0;
  if (asOf && previous && asOf <= previous) return matches;
  const index = matches.findIndex((match) => match.id === matchId);
  if (index < 0) return matches;
  if (asOf) seenAt.set(matchId, asOf);
  const status = typeof event.data?.status === 'string' ? event.data.status : matches[index].status;
  const score = typeof event.data?.score === 'string' ? event.data.score : matches[index].score;
  const next = matches.slice();
  next[index] = { ...matches[index], status, score };
  return next;
}

export function sameCryptoSymbol(updateSymbol: string, chartSymbol: string): boolean {
  const left = updateSymbol.replace(/USDT$/i, '').toUpperCase();
  const right = chartSymbol.replace(/USDT$/i, '').toUpperCase();
  return left === right && left.length > 0;
}

function eventTime(event: ProviderEvent): number {
  const asOf = event.data?.asOf;
  const parsed = typeof asOf === 'string' ? Date.parse(asOf) : Number.NaN;
  if (Number.isFinite(parsed)) return parsed;
  const timestamp = event.timestamp ? Date.parse(event.timestamp) : Number.NaN;
  return Number.isFinite(timestamp) ? timestamp : 0;
}
