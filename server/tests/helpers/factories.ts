import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';

import { LOOKUP_IDS } from '../../src/lib/lookupCache';
import { ROLE_IDS, RoleCode } from '../../src/lib/roleCache';
import { prisma } from './db';

export const DEFAULT_PASSWORD = 'password123';
export const SUPER_ADMIN_EMAIL = 'admin@pulseplay.local';
// Hashed once at cost 4: production uses cost 10, but hashing per test would
// make the suite crawl and the cost factor isn't what these tests exercise.
const PASSWORD_HASH = bcrypt.hashSync(DEFAULT_PASSWORD, 4);

let sequence = 0;
const next = () => (sequence += 1);

export async function createClient(overrides: Partial<Prisma.ClientUncheckedCreateInput> = {}) {
  const n = next();
  return prisma.client.create({ data: { code: `CLIENT${n}`, name: `Client ${n}`, ...overrides } });
}

async function defaultClient() {
  return (await prisma.client.findUnique({ where: { code: 'DEFAULT' } })) ?? createClient({ code: 'DEFAULT', name: 'Default Client' });
}

type UserOverrides = Partial<Prisma.UserUncheckedCreateInput> & { role?: RoleCode };

// Defaults to a CLIENT_USER of a shared default client. SUPER_ADMIN gets no
// client (the DB trigger requires exactly that); any other role without an
// explicit clientId gets the default client.
export async function createUser({ role = 'CLIENT_USER', ...overrides }: UserOverrides = {}) {
  const n = next();
  const clientId =
    overrides.clientId !== undefined ? overrides.clientId : role === 'SUPER_ADMIN' ? null : (await defaultClient()).id;
  return prisma.user.create({
    data: {
      name: `Test User ${n}`,
      userCode: `ID#T${n}`,
      email: `user${n}@test.local`,
      mobile: String(9_000_000_000 + n),
      passwordHash: PASSWORD_HASH,
      roleId: ROLE_IDS[role],
      ...overrides,
      clientId,
    },
  });
}

export async function createAdminUser() {
  return createUser({ role: 'SUPER_ADMIN', email: SUPER_ADMIN_EMAIL, name: 'System Admin' });
}

export async function createWallet(userId: number, available = 1000, locked = 0) {
  return prisma.wallet.create({
    data: {
      userId,
      currency: 'INR',
      availableBalance: available,
      lockedBalance: locked,
      statusId: LOOKUP_IDS.WALLET_STATUS.ACTIVE,
    },
  });
}

export async function createUserWithWallet(available = 1000, locked = 0, overrides: UserOverrides = {}) {
  const user = await createUser(overrides);
  const wallet = await createWallet(user.id, available, locked);
  return { user, wallet };
}

export async function createOpenMarket(prices: number[] = [2.0, 3.0]) {
  const event = await prisma.event.create({
    data: {
      categoryId: LOOKUP_IDS.EVENT_CATEGORY.CRICKET,
      name: 'Team A vs Team B',
      competition: 'Test League',
      startTime: new Date(),
      statusId: LOOKUP_IDS.EVENT_STATUS.LIVE,
      homeTeamName: 'Team A',
      homeTeamShort: 'TMA',
      awayTeamName: 'Team B',
      awayTeamShort: 'TMB',
    },
  });
  const market = await prisma.market.create({
    data: {
      eventId: event.id,
      marketType: 'MATCH_WINNER',
      name: 'Match Winner',
      statusId: LOOKUP_IDS.MARKET_STATUS.OPEN,
      selections: {
        create: prices.map((price, index) => ({
          code: `SEL${index}`,
          name: `Selection ${index}`,
          currentPrice: price,
          statusId: LOOKUP_IDS.MARKET_STATUS.OPEN,
          sortOrder: index,
        })),
      },
    },
    include: { selections: { orderBy: { sortOrder: 'asc' } } },
  });
  return { event, market, selections: market.selections };
}

type Ref = { id: number; name: string };

export function betLeg(event: Ref, market: Ref, selection: Ref) {
  return {
    eventId: event.id,
    eventName: event.name,
    marketId: market.id,
    marketName: market.name,
    selectionId: selection.id,
    selectionName: selection.name,
  };
}
