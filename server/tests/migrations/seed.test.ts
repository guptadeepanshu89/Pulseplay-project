import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { prisma } from '../helpers/db';
import { TEST_ENV } from '../testEnv';

const runSeed = () =>
  execSync('npx tsx src/seed.ts', { cwd: process.cwd(), env: { ...process.env, ...TEST_ENV }, stdio: 'pipe' });

async function snapshot() {
  const [users, clients, requests, bets, roles] = await Promise.all([
    prisma.user.count(),
    prisma.client.count(),
    prisma.walletRequest.count(),
    prisma.bet.count(),
    prisma.role.count(),
  ]);
  return { users, clients, requests, bets, roles };
}

describe('MG-07 — seeding', () => {
  it('is idempotent: running it twice leaves the same data, roles untouched', async () => {
    runSeed();
    const first = await snapshot();
    runSeed();
    const second = await snapshot();

    expect(second).toEqual(first);
    expect(first).toEqual({ users: 3, clients: 1, requests: 4, bets: 4, roles: 3 });
  });

  it('creates one SUPER_ADMIN (no client), one CLIENT_ADMIN and one CLIENT_USER, the latter two in the Demo Client', async () => {
    runSeed();
    const users = await prisma.user.findMany({ include: { Role: true, client: true }, orderBy: { id: 'asc' } });

    expect(users.map((user) => [user.Role.code, user.client?.code ?? null])).toEqual([
      ['SUPER_ADMIN', null],
      ['CLIENT_ADMIN', 'DEMO'],
      ['CLIENT_USER', 'DEMO'],
    ]);
  });

  it('TN-11 tenant keys agree with the owning user on every bet and fund request', async () => {
    runSeed();
    const [{ bad }] = await prisma.$queryRaw<{ bad: number }[]>`
      SELECT (SELECT count(*)::int FROM "Bet" b JOIN "User" u ON u."id" = b."userId" WHERE b."clientId" IS DISTINCT FROM u."clientId")
           + (SELECT count(*)::int FROM "WalletRequest" r JOIN "User" u ON u."id" = r."userId" WHERE r."clientId" IS DISTINCT FROM u."clientId") AS bad`;
    expect(bad).toBe(0);
  });
});
