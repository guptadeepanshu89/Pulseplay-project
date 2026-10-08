import { Prisma, PrismaClient } from '@prisma/client';

interface VwNotificationRow {
  id: number;
  userId: number;
  typeCode: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

// `whereSql` filters the `vw_notifications n` row set.
export async function fetchNotifications(prisma: PrismaClient, whereSql: Prisma.Sql) {
  const rows = await prisma.$queryRaw<VwNotificationRow[]>(
    Prisma.sql`SELECT id, "userId", "typeCode", title, message, read, "createdAt" FROM vw_notifications n ${whereSql} ORDER BY n."createdAt" DESC`,
  );
  return rows.map((row) => ({
    id: row.id,
    type: row.typeCode,
    title: row.title,
    message: row.message,
    read: row.read,
    createdAt: row.createdAt,
  }));
}
