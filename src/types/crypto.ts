export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface CryptoPriceHistory {
  points: PricePoint[];
  currentPrice: number;
  changePercent: number;
  changeAmount: number;
  stale?: boolean;
  asOf?: number | null;
}

export type ChartTimeframe = '24H' | '1W' | '1M' | '1Y' | 'ALL';
