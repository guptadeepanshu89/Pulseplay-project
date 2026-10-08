import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { migrationNames, migrationSql, runSql, schemaMatchesDatabase } from '../helpers/sql';
import { prisma } from '../helpers/db';
import { TEST_DATABASE_URL } from '../testEnv';

const RBAC = '_rbac_multi_tenancy';
const BACKFILL_URL = TEST_DATABASE_URL.replace('schema=test', 'schema=mg_backfill');

// A lookup id by (type, code) — the same way the app resolves them.
const lk = (type: string, code: string) =>
  `(SELECT l."id" FROM "Lookup" l JOIN "LookupType" t ON t."id" = l."lookupTypeId" WHERE t."code" = '${type}' AND l."code" = '${code}')`;

// What a pre-RBAC database looks like: an admin identity, two players, and
// the free-text 'admin' actor strings the migration has to turn into ids.
const LEGACY_DATA = `
INSERT INTO "User" ("name","userCode","email","mobile","passwordHash","updatedAt") VALUES
  ('System Admin','ID#ADMIN','admin@pulseplay.local','0000000000','x',now()),
  ('Rohan','ID#1','rohan@example.com','9876543210','x',now()),
  ('Priya','ID#2','priya@example.com','9876543211','x',now());

INSERT INTO "Wallet" ("userId","currency","availableBalance","lockedBalance","statusId","updatedAt")
  SELECT "id",'INR',100,0,${lk('WALLET_STATUS', 'ACTIVE')},now() FROM "User" WHERE "email" IN ('rohan@example.com','priya@example.com');

INSERT INTO "Bet" ("userId","stake","combinedOdds","potentialReturn","statusId","legCount","updatedAt")
  SELECT "id",10,2,20,${lk('BET_STATUS', 'OPEN')},1,now() FROM "User" WHERE "email" = 'rohan@example.com';

INSERT INTO "WalletRequest" ("walletId","userId","typeId","amount","reason","statusId","resolvedBy","resolvedAt")
  SELECT w."id",w."userId",${lk('WALLET_REQUEST_TYPE', 'INCREASE')},500,'approved earlier',${lk('WALLET_REQUEST_STATUS', 'APPROVED')},'admin',now()
    FROM "Wallet" w JOIN "User" u ON u."id" = w."userId" WHERE u."email" = 'rohan@example.com';
INSERT INTO "WalletRequest" ("walletId","userId","typeId","amount","reason","statusId")
  SELECT w."id",w."userId",${lk('WALLET_REQUEST_TYPE', 'INCREASE')},900,'still pending',${lk('WALLET_REQUEST_STATUS', 'PENDING')}
    FROM "Wallet" w JOIN "User" u ON u."id" = w."userId" WHERE u."email" = 'priya@example.com';

INSERT INTO "WalletTransaction" ("walletId","userId","typeId","amount","statusId","createdBy")
  SELECT w."id",w."userId",${lk('WALLET_TRANSACTION_TYPE', 'ADMIN_CREDIT')},500,${lk('WALLET_TRANSACTION_STATUS', 'COMPLETED')},'admin'
    FROM "Wallet" w JOIN "User" u ON u."id" = w."userId" WHERE u."email" = 'rohan@example.com';
INSERT INTO "WalletLedger" ("walletId","userId","transactionTypeId","amount","beforeAvailable","afterAvailable","beforeLocked","afterLocked","statusId","createdBy")
  SELECT w."id",w."userId",${lk('WALLET_TRANSACTION_TYPE', 'ADMIN_CREDIT')},500,100,600,0,0,${lk('WALLET_TRANSACTION_STATUS', 'COMPLETED')},'admin'
    FROM "Wallet" w JOIN "User" u ON u."id" = w."userId" WHERE u."email" = 'rohan@example.com';
`;

describe('MG — RBAC migration', () => {
  it('MG-01 the test schema (all migrations on an empty DB) matches schema.prisma exactly', () => {
    expect(schemaMatchesDatabase(TEST_DATABASE_URL)).toBe(true);
  });

  it('MG-03 reference data: exactly three roles', async () => {
    const roles = await prisma.role.findMany({ orderBy: { id: 'asc' } });
    expect(roles.map((role) => role.code)).toEqual(['SUPER_ADMIN', 'CLIENT_ADMIN', 'CLIENT_USER']);
  });
});

describe('MG-02 — RBAC migration on a database that already has data', () => {
  let legacy: PrismaClient;
  const q = <T>(sql: string) => legacy.$queryRawUnsafe<T[]>(sql);

  beforeAll(async () => {
    const names = migrationNames();
    const rbac = names.find((name) => name.endsWith(RBAC));
    if (!rbac) throw new Error('RBAC migration not found');
    const before = names.filter((name) => name < rbac);
    const after = names.filter((name) => name > rbac);

    const admin = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    await admin.$executeRawUnsafe('DROP SCHEMA IF EXISTS "mg_backfill" CASCADE');
    await admin.$executeRawUnsafe('CREATE SCHEMA "mg_backfill"');
    await admin.$disconnect();

    runSql(BACKFILL_URL, migrationSql(before)); // database as it was before RBAC
    runSql(BACKFILL_URL, LEGACY_DATA);
    runSql(BACKFILL_URL, migrationSql([rbac])); // the migration under test
    runSql(BACKFILL_URL, migrationSql(after)); // anything shipped after it

    legacy = new PrismaClient({ datasources: { db: { url: BACKFILL_URL } } });
  });

  afterAll(async () => {
    await legacy?.$disconnect();
    const admin = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
    await admin.$executeRawUnsafe('DROP SCHEMA IF EXISTS "mg_backfill" CASCADE');
    await admin.$disconnect();
  });

  it('keeps every row', async () => {
    const [counts] = await q<{ users: number; wallets: number; bets: number; requests: number; txns: number; ledger: number }>(
      `SELECT (SELECT count(*)::int FROM "User") users, (SELECT count(*)::int FROM "Wallet") wallets,
              (SELECT count(*)::int FROM "Bet") bets, (SELECT count(*)::int FROM "WalletRequest") requests,
              (SELECT count(*)::int FROM "WalletTransaction") txns, (SELECT count(*)::int FROM "WalletLedger") ledger`,
    );
    expect(counts).toEqual({ users: 3, wallets: 2, bets: 1, requests: 2, txns: 1, ledger: 1 });
  });

  it('seeds the Demo Client, active', async () => {
    const clients = await q<{ code: string; isActive: number; isDeleted: number }>(`SELECT "code","isActive","isDeleted" FROM "Client"`);
    expect(clients).toEqual([{ code: 'DEMO', isActive: 1, isDeleted: 0 }]);
  });

  it('turns the old admin identity into the SUPER_ADMIN (no client) and everyone else into CLIENT_USERs of the Demo Client', async () => {
    const users = await q<{ email: string; role: string; client: string | null; isActive: number; mustChangePassword: number }>(
      `SELECT u."email", r."code" AS role, c."code" AS client, u."isActive", u."mustChangePassword"
         FROM "User" u JOIN "Role" r ON r."id" = u."roleId" LEFT JOIN "Client" c ON c."id" = u."clientId" ORDER BY u."id"`,
    );
    expect(users).toEqual([
      { email: 'admin@pulseplay.local', role: 'SUPER_ADMIN', client: null, isActive: 1, mustChangePassword: 0 },
      { email: 'rohan@example.com', role: 'CLIENT_USER', client: 'DEMO', isActive: 1, mustChangePassword: 0 },
      { email: 'priya@example.com', role: 'CLIENT_USER', client: 'DEMO', isActive: 1, mustChangePassword: 0 },
    ]);
  });

  it('gives every existing bet and fund request the Demo Client as its tenant', async () => {
    const [{ bad }] = await q<{ bad: number }>(
      `SELECT (SELECT count(*)::int FROM "Bet" b JOIN "User" u ON u."id" = b."userId" WHERE b."clientId" IS DISTINCT FROM u."clientId")
            + (SELECT count(*)::int FROM "WalletRequest" r JOIN "User" u ON u."id" = r."userId" WHERE r."clientId" IS DISTINCT FROM u."clientId") AS bad`,
    );
    expect(bad).toBe(0);
  });

  it('MG-04 maps the free-text actor "admin" to the SuperAdmin user id and drops the old columns', async () => {
    const [{ id: adminId }] = await q<{ id: number }>(`SELECT "id" FROM "User" WHERE "email" = 'admin@pulseplay.local'`);
    const resolved = await q<{ resolvedByUserId: number | null; reason: string }>(`SELECT "resolvedByUserId","reason" FROM "WalletRequest" ORDER BY "id"`);
    expect(resolved).toEqual([
      { resolvedByUserId: adminId, reason: 'approved earlier' },
      { resolvedByUserId: null, reason: 'still pending' },
    ]);
    const [txn] = await q<{ createdByUserId: number }>(`SELECT "createdByUserId" FROM "WalletTransaction"`);
    const [ledger] = await q<{ createdByUserId: number }>(`SELECT "createdByUserId" FROM "WalletLedger"`);
    expect(txn.createdByUserId).toBe(adminId);
    expect(ledger.createdByUserId).toBe(adminId);

    const legacyColumns = await q<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND column_name IN ('resolvedBy','createdBy')`,
    );
    expect(legacyColumns).toEqual([]);
  });

  it('MG-05 recreates every reporting view, exposing the new columns', async () => {
    for (const view of ['vw_events', 'vw_markets', 'vw_market_selections', 'vw_bets', 'vw_wallets', 'vw_wallet_transactions', 'vw_wallet_ledger', 'vw_wallet_requests', 'vw_notifications']) {
      await expect(q(`SELECT * FROM "${view}" LIMIT 1`), view).resolves.toBeDefined();
    }
    const bets = await q<{ clientId: number; statusCode: string }>(`SELECT "clientId","statusCode" FROM "vw_bets"`);
    expect(bets).toHaveLength(1);
    expect(bets[0].statusCode).toBe('OPEN');
    const requests = await q<{ clientId: number; resolvedByUserId: number | null }>(`SELECT "clientId","resolvedByUserId" FROM "vw_wallet_requests"`);
    expect(requests).toHaveLength(2);
    const transactions = await q<{ createdByUserId: number }>(`SELECT "createdByUserId" FROM "vw_wallet_transactions"`);
    expect(transactions).toHaveLength(1);
  });

  it('MG-09 a DB trigger keeps SUPER_ADMIN clientless and every other role attached to a client', async () => {
    const [{ role: superAdmin }] = await q<{ role: number }>(`SELECT "id" AS role FROM "Role" WHERE "code" = 'SUPER_ADMIN'`);
    const [{ role: clientUser }] = await q<{ role: number }>(`SELECT "id" AS role FROM "Role" WHERE "code" = 'CLIENT_USER'`);
    const [{ id: demo }] = await q<{ id: number }>(`SELECT "id" FROM "Client" WHERE "code" = 'DEMO'`);
    const insert = (email: string, mobile: string, roleId: number, clientId: number | null) =>
      legacy.$executeRawUnsafe(
        `INSERT INTO "User" ("name","userCode","email","mobile","passwordHash","updatedAt","roleId","clientId") VALUES ('t','${email}','${email}','${mobile}','x',now(),${roleId},${clientId ?? 'NULL'})`,
      );

    await expect(insert('sa-with-client', '1', superAdmin, demo)).rejects.toThrow(/must not belong to a client/);
    await expect(insert('player-no-client', '2', clientUser, null)).rejects.toThrow(/requires a client/);
    await expect(insert('sa-ok', '3', superAdmin, null)).resolves.toBeDefined();
    await expect(legacy.$executeRawUnsafe(`UPDATE "User" SET "clientId" = NULL WHERE "email" = 'rohan@example.com'`)).rejects.toThrow(/requires a client/);
  });

  it('MG-10 a user with history cannot be physically deleted (FKs restrict)', async () => {
    await expect(legacy.$executeRawUnsafe(`DELETE FROM "User" WHERE "email" = 'rohan@example.com'`)).rejects.toThrow();
  });

  it('MG-01b the migrated-with-data database also matches schema.prisma exactly (no drift vs a fresh one)', () => {
    expect(schemaMatchesDatabase(BACKFILL_URL)).toBe(true);
  });
});
