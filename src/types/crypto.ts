export interface PricePoint {
  timestamp: number;
  price: number;
}

export interface CryptoPriceHistory {
  points: PricePoint[];
  currentPrice: number;
  changePercent: number;
  changeAmount: number;
}

export type ChartTimeframe = '24H' | '1W' | '1M' | '1Y' | 'ALL';
