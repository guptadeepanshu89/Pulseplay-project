import { prisma } from '../../src/db';

export { prisma };

// Every transactional/demo table (Client included: tenants are test data).
// Reference data (Lookup, LookupType, Role) is deliberately NOT listed: it
// comes from migrations and must survive between tests.
const DATA_TABLES = [
  'BetSelectionLeg',
  'Bet',
  'WalletLedger',
  'WalletTransaction',
  'WalletRequest',
  'Wallet',
  'Notification',
  'MarketSelection',
  'Market',
  'Event',
  'PriceHistory',
  'User',
  'Client',
];

export async function resetDb(): Promise<void> {
  const [{ schema }] = await prisma.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`;
  if (schema !== 'test') {
    throw new Error(`resetDb refused to run against schema "${schema}" — tests must only ever touch schema "test"`);
  }
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${DATA_TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`);
}
