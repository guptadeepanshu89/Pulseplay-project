import { Prisma, PrismaClient } from '@prisma/client';

interface VwWalletTransactionRow {
  id: number;
  typeCode: string;
  amount: Prisma.Decimal;
  statusCode: string;
  createdAt: Date;
}

// `whereSql` filters the `vw_wallet_transactions wt` row set.
export async function fetchWalletTransactions(prisma: PrismaClient, whereSql: Prisma.Sql) {
  const rows = await prisma.$queryRaw<VwWalletTransactionRow[]>(
    Prisma.sql`SELECT id, "typeCode", amount, "statusCode", "createdAt" FROM vw_wallet_transactions wt ${whereSql} ORDER BY wt."createdAt" DESC`,
  );
  return rows.map((row) => ({ id: row.id, type: row.typeCode, amount: row.amount, status: row.statusCode, createdAt: row.createdAt }));
}

interface VwWalletRequestRow {
  id: number;
  typeCode: string;
  amount: Prisma.Decimal;
  reason: string;
  statusCode: string;
  requestedAt: Date;
  resolvedAt: Date | null;
}

// `whereSql` filters the `vw_wallet_requests wr` row set.
export async function fetchWalletRequests(prisma: PrismaClient, whereSql: Prisma.Sql) {
  const rows = await prisma.$queryRaw<VwWalletRequestRow[]>(
    Prisma.sql`SELECT id, "typeCode", amount, reason, "statusCode", "requestedAt", "resolvedAt" FROM vw_wallet_requests wr ${whereSql} ORDER BY wr."requestedAt" DESC`,
  );
  return rows.map((row) => ({
    id: row.id,
    type: row.typeCode,
    amount: row.amount,
    reason: row.reason,
    status: row.statusCode,
    requestedAt: row.requestedAt,
    resolvedAt: row.resolvedAt ?? undefined,
  }));
}
