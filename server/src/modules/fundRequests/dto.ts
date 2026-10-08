import { Prisma, PrismaClient } from '@prisma/client';

// The admin-panel view of a fund request: unlike the player's own
// `/wallet/requests` (lib/walletDto.ts), this one names who filed it and
// which client it belongs to, so it needs its own query.

interface AdminFundRequestRow {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  clientId: number;
  clientName: string;
  clientCode: string;
  typeCode: string;
  amount: Prisma.Decimal;
  reason: string;
  statusCode: string;
  requestedAt: Date;
  resolvedAt: Date | null;
  resolvedByUserId: number | null;
  resolvedByName: string | null;
}

const FROM = Prisma.sql`
  FROM vw_wallet_requests wr
  JOIN "User" u ON u.id = wr."userId"
  JOIN "Client" c ON c.id = wr."clientId"
  LEFT JOIN "User" ru ON ru.id = wr."resolvedByUserId"
`;

const COLUMNS = Prisma.sql`
  wr.id, wr."userId", u.name AS "userName", u.email AS "userEmail",
  wr."clientId", c.name AS "clientName", c.code AS "clientCode",
  wr."typeCode", wr.amount, wr.reason, wr."statusCode",
  wr."requestedAt", wr."resolvedAt", wr."resolvedByUserId", ru.name AS "resolvedByName"
`;

export async function fetchAdminFundRequestsPage(prisma: PrismaClient, whereSql: Prisma.Sql, limit: number, offset: number) {
  const [rows, totals] = await Promise.all([
    prisma.$queryRaw<AdminFundRequestRow[]>(
      Prisma.sql`SELECT ${COLUMNS} ${FROM} ${whereSql} ORDER BY wr."requestedAt" DESC LIMIT ${limit} OFFSET ${offset}`,
    ),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`SELECT count(*)::bigint AS count ${FROM} ${whereSql}`),
  ]);
  return { rows: rows.map(toFundRequestDto), total: Number(totals[0].count) };
}

export async function fetchAdminFundRequestById(prisma: PrismaClient, id: number) {
  const rows = await prisma.$queryRaw<AdminFundRequestRow[]>(Prisma.sql`SELECT ${COLUMNS} ${FROM} WHERE wr.id = ${id}`);
  return rows[0];
}

export function toFundRequestDto(row: AdminFundRequestRow) {
  return {
    id: row.id,
    user: { id: row.userId, name: row.userName, email: row.userEmail },
    client: { id: row.clientId, name: row.clientName, code: row.clientCode },
    type: row.typeCode,
    amount: row.amount,
    reason: row.reason,
    status: row.statusCode,
    requestedAt: row.requestedAt,
    resolvedAt: row.resolvedAt ?? undefined,
    resolvedBy: row.resolvedByUserId ? { id: row.resolvedByUserId, name: row.resolvedByName } : undefined,
  };
}
