const ODDS_DECIMAL_PLACES = 2;

/**
 * Mirrors src/utils/formatOdds.ts's calculatePotentialReturn exactly (floor to 2dp,
 * not the default "round half up" a Decimal library would otherwise apply).
 */
export function calculatePotentialReturn(stake: number, price: number): number {
  const raw = stake * price;
  const factor = 10 ** ODDS_DECIMAL_PLACES;
  return Math.floor(raw * factor) / factor;
}
