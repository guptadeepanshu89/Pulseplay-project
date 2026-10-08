export type MarketStatus = 'OPEN' | 'SUSPENDED' | 'CLOSED' | 'SETTLED';

export interface MarketSelection {
  id: number;
  marketId: number;
  code: string;
  name: string;
  currentPrice: number;
  priceVersion: number;
  status: MarketStatus;
}

export interface Market {
  id: number;
  eventId: number;
  marketType: string;
  name: string;
  status: MarketStatus;
  version: number;
  selections: MarketSelection[];
}
