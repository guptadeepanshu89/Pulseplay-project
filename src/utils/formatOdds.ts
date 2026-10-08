const ODDS_DECIMAL_PLACES = 2;

export function formatOdds(price: number): string {
  return price.toFixed(ODDS_DECIMAL_PLACES);
}

export function calculatePotentialReturn(stake: number, price: number): number {
  const raw = stake * price;
  const factor = 10 ** ODDS_DECIMAL_PLACES;
  return Math.floor(raw * factor) / factor;
}
