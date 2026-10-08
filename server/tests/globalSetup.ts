import { execSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

import { TEST_DATABASE_URL } from './testEnv';

// Runs once per `vitest run`: rebuild the `test` schema from scratch and apply
// every real migration to it — so the suite exercises exactly the schema,
// views and reference data production would get, not a hand-made copy.
export default async function setup() {
  if (!/[?&]schema=test(&|$)/.test(TEST_DATABASE_URL)) {
    throw new Error(`Refusing to run: test DB url must target schema=test, got ${TEST_DATABASE_URL}`);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: TEST_DATABASE_URL } } });
  try {
    await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS "test" CASCADE');
    await prisma.$executeRawUnsafe('CREATE SCHEMA "test"');
  } finally {
    await prisma.$disconnect();
  }

  execSync('npx prisma migrate deploy', {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}
