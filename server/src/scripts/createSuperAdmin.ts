import { parseArgs } from 'node:util';

import { prisma } from '../db';
import { loadRoleCache } from '../lib/roleCache';
import { createSuperAdmin, SuperAdminError } from '../modules/users/superAdmin';

const USAGE = 'Usage: npm run create-superadmin -- --name "Full Name" --email you@example.com --mobile 9876543210';

function readArgs() {
  try {
    return parseArgs({ options: { name: { type: 'string' }, email: { type: 'string' }, mobile: { type: 'string' } } }).values;
  } catch (error) {
    // e.g. a name with spaces that was not quoted
    throw new SuperAdminError(`${(error as Error).message}\n${USAGE}`);
  }
}

async function main() {
  const { name, email, mobile } = readArgs();
  if (!name || !email || !mobile) throw new SuperAdminError(`--name, --email and --mobile are all required\n${USAGE}`);

  await loadRoleCache();
  const created = await createSuperAdmin({ name, email, mobile });

  console.log(`Created SUPER_ADMIN #${created.userId}`);
  console.log(`  email:    ${created.email}`);
  console.log(`  password: ${created.password}`);
  console.log('This password is shown only once and must be changed at first sign-in.');
}

main()
  .catch((error) => {
    // A mistake in the arguments is the operator's to fix, not a stack trace.
    console.error(error instanceof SuperAdminError ? `Error: ${error.message}` : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
