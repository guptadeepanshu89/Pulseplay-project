import { Prisma, PrismaClient } from '@prisma/client';

// Same principle as marketDto.ts: the status text comes from vw_bets (a raw
// SQL SELECT against the view), not a base-table query + in-memory lookup
// substitution. BetSelectionLeg has no lookup/categorical field at all, so
// it's read from its plain table — no view needed for it.

interface VwBetRow {
  id: number;
  userId: number;
  stake: Prisma.Decimal;
  combinedOdds: Prisma.Decimal;
  potentialReturn: Prisma.Decimal;
  statusCode: string;
  legCount: number;
  placedAt: Date;
  settledAt: Date | null;
}

// Shared by bets.ts and admin.ts. `whereSql` filters the `vw_bets b` row set,
// e.g. Prisma.sql`WHERE b.id = ${id} AND b."userId" = ${userId}`.
export async function fetchBetsWithSelections(prisma: PrismaClient, whereSql: Prisma.Sql) {
  const bets = await prisma.$queryRaw<VwBetRow[]>(
    Prisma.sql`SELECT id, "userId", stake, "combinedOdds", "potentialReturn", "statusCode", "legCount", "placedAt", "settledAt" FROM vw_bets b ${whereSql} ORDER BY b."placedAt" DESC`,
  );
  if (bets.length === 0) return [];

  const betIds = bets.map((bet) => bet.id);
  const userIds = [...new Set(bets.map((bet) => bet.userId))];
  const [legs, users] = await Promise.all([
    prisma.betSelectionLeg.findMany({ where: { betId: { in: betIds } } }),
    prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true, mobile: true } }),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));

  return bets.map((bet) => ({
    id: bet.id,
    userId: bet.userId,
    userName: userById.get(bet.userId)?.name ?? `User #${bet.userId}`,
    userEmail: userById.get(bet.userId)?.email,
    userMobile: userById.get(bet.userId)?.mobile,
    stake: bet.stake,
    combinedOdds: bet.combinedOdds,
    potentialReturn: bet.potentialReturn,
    status: bet.statusCode,
    legCount: bet.legCount,
    placedAt: bet.placedAt,
    settledAt: bet.settledAt ?? undefined,
    selections: legs
      .filter((leg) => leg.betId === bet.id)
      .map((leg) => ({
        eventId: leg.eventId,
        eventName: leg.eventName,
        marketId: leg.marketId,
        marketName: leg.marketName,
        selectionId: leg.selectionId,
        selectionName: leg.selectionName,
        oddsAtPlacement: leg.oddsAtPlacement,
      })),
  }));
}
