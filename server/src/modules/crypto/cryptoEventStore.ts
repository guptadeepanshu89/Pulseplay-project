import { LOOKUP_IDS } from '../../lib/lookupCache';
import { prisma } from '../../db';

/**
 * Persist / read the 24h change percent for a crypto chart symbol.
 *
 * Uses the checked-in Prisma `Event` model (`symbol` + `changePercent24h`).
 * Category-split `CryptoEvent` tables from untracked migrations are NOT assumed
 * and are not written here — Option A does not apply those migrations.
 *
 * Soft-fails for callers: missing rows or lookup cache miss return null / no-op
 * so PriceHistory + socket spot updates still work when no crypto Event exists.
 */
function cryptoCategoryFilter(): { categoryId?: number } {
  const categoryId = LOOKUP_IDS.EVENT_CATEGORY?.CRYPTO;
  return typeof categoryId === 'number' ? { categoryId } : {};
}

export async function readCryptoChangePercent24h(symbol: string): Promise<number | null> {
  const event = await prisma.event.findFirst({
    where: { symbol, isDeleted: 0, ...cryptoCategoryFilter() },
    select: { changePercent24h: true },
  });
  if (event?.changePercent24h == null) return null;
  const n = Number(event.changePercent24h);
  return Number.isFinite(n) ? n : null;
}

export async function writeCryptoChangePercent24h(symbol: string, changePercent24h: number): Promise<void> {
  if (!Number.isFinite(changePercent24h)) return;
  const event = await prisma.event.findFirst({
    where: { symbol, isDeleted: 0, ...cryptoCategoryFilter() },
    select: { id: true },
  });
  if (!event) return;
  await prisma.event.update({
    where: { id: event.id },
    data: { changePercent24h },
  });
}
