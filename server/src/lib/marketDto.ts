import { Prisma, PrismaClient } from '@prisma/client';

// The text a client sees (status) must come from the DB view, not a
// base-table query + in-memory ID→code substitution — so every read here
// is a raw SQL SELECT against vw_markets / vw_market_selections. Writes
// still go to the base tables via LOOKUP_IDS (views aren't writable).

interface VwMarketRow {
  id: number;
  eventId: number;
  marketType: string;
  name: string;
  statusCode: string;
  version: number;
}

interface VwMarketSelectionRow {
  id: number;
  marketId: number;
  code: string;
  name: string;
  currentPrice: Prisma.Decimal;
  priceVersion: number;
  statusCode: string;
  sortOrder: number;
}

// Shared by events.ts (GET /:eventId/markets) and markets.ts (GET /, GET /:id).
// `whereSql` filters the `vw_markets m` row set, e.g. Prisma.sql`WHERE m.id = ${id}`.
export async function fetchMarketsWithSelections(prisma: PrismaClient, whereSql: Prisma.Sql) {
  const markets = await prisma.$queryRaw<VwMarketRow[]>(
    Prisma.sql`SELECT id, "eventId", "marketType", name, "statusCode", version FROM vw_markets m ${whereSql} ORDER BY m.id ASC`,
  );
  if (markets.length === 0) return [];

  const marketIds = markets.map((market) => market.id);
  const selections = await prisma.$queryRaw<VwMarketSelectionRow[]>(
    Prisma.sql`SELECT id, "marketId", code, name, "currentPrice", "priceVersion", "statusCode", "sortOrder" FROM vw_market_selections WHERE "marketId" IN (${Prisma.join(marketIds)}) ORDER BY "sortOrder" ASC`,
  );

  return markets.map((market) => ({
    id: market.id,
    eventId: market.eventId,
    marketType: market.marketType,
    name: market.name,
    status: market.statusCode,
    version: market.version,
    selections: selections
      .filter((selection) => selection.marketId === market.id)
      .map((selection) => ({
        id: selection.id,
        marketId: selection.marketId,
        code: selection.code,
        name: selection.name,
        currentPrice: selection.currentPrice,
        priceVersion: selection.priceVersion,
        status: selection.statusCode,
        sortOrder: selection.sortOrder,
      })),
  }));
}
