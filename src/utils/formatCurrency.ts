const CURRENCY_SYMBOL = '₹';
const DECIMAL_PLACES = 2;

export function formatCurrency(amount: number): string {
  const formatted = amount.toLocaleString('en-IN', {
    minimumFractionDigits: DECIMAL_PLACES,
    maximumFractionDigits: DECIMAL_PLACES,
  });
  return `${CURRENCY_SYMBOL}${formatted}`;
}

export function formatCurrencyCompact(amount: number): string {
  const formatted = amount.toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  });
  return `${CURRENCY_SYMBOL}${formatted}`;
}

export function formatUsd(amount: number): string {
  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: DECIMAL_PLACES,
    maximumFractionDigits: DECIMAL_PLACES,
  });
  return `$${formatted}`;
}
