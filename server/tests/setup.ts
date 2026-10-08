import { afterAll, beforeAll, beforeEach } from 'vitest';

import { loadLookupCache } from '../src/lib/lookupCache';
import { loadRoleCache } from '../src/lib/roleCache';
import { prisma, resetDb } from './helpers/db';

// Registered for every test file (vitest `setupFiles`).
beforeAll(async () => {
  await loadLookupCache();
  await loadRoleCache();
});

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});
