import { Prisma } from '@prisma/client';

/**
 * Prisma's Decimal fields serialize to strings via JSON.stringify (Decimal.toJSON),
 * which silently breaks the mobile client's formatCurrency/formatOdds (they call
 * Number.prototype methods). Recursively convert every Decimal to a plain number
 * before any res.json() call.
 */
export function serialize<T>(value: T): T {
  if (value instanceof Prisma.Decimal) {
    return value.toNumber() as unknown as T;
  }
  if (value instanceof Date) {
    return value.toISOString() as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => serialize(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = serialize(val);
    }
    return result as T;
  }
  return value;
}
