import { describe, expect, it } from 'vitest';

import { prisma } from '../helpers/db';

// MG-06: the composite indexes exist to serve exactly these tenant-scoped list
// queries. Tables are empty here, so the planner is told not to fall back to a
// sequential scan — the test proves the index *shape* matches the query
// (leading column equality, sort column last), not that the optimiser prefers
// it at volume (that is the performance suite's job).
async function planFor(sql: string): Promise<string> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe('SET LOCAL enable_seqscan = off');
    // With empty-table statistics the planner would otherwise pick a bitmap
    // scan + explicit Sort for a tiny estimated row count; we want to know
    // whether the index itself can deliver the ORDER BY.
    await tx.$executeRawUnsafe('SET LOCAL enable_bitmapscan = off');
    const rows = await tx.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(`EXPLAIN ${sql}`);
    return rows.map((row) => row['QUERY PLAN']).join('\n');
  });
}

describe('MG-06 — tenant-scoped queries are index-backed', () => {
  it('fund-request approval queue uses WalletRequest(clientId, statusId, requestedAt DESC)', async () => {
    const plan = await planFor(
      `SELECT * FROM "WalletRequest" WHERE "clientId" = 1 AND "statusId" = 1 ORDER BY "requestedAt" DESC LIMIT 25`,
    );
    expect(plan).toContain('WalletRequest_clientId_statusId_requestedAt_idx');
    expect(plan).not.toMatch(/\bSort\b/); // the index already provides the ordering
  });

  it('client user list uses User(clientId, roleId, isDeleted)', async () => {
    const plan = await planFor(`SELECT * FROM "User" WHERE "clientId" = 1 AND "roleId" = 3 AND "isDeleted" = 0`);
    expect(plan).toContain('User_clientId_roleId_isDeleted_idx');
  });

  it('tenant bet list uses Bet(clientId, placedAt DESC)', async () => {
    const plan = await planFor(`SELECT * FROM "Bet" WHERE "clientId" = 1 ORDER BY "placedAt" DESC LIMIT 25`);
    expect(plan).toContain('Bet_clientId_placedAt_idx');
    expect(plan).not.toMatch(/\bSort\b/);
  });
});
