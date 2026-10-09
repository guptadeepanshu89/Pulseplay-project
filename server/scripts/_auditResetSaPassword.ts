import bcrypt from 'bcryptjs';
import { prisma } from '../src/db';
import { env } from '../src/env';

async function main() {
  const hash = await bcrypt.hash('DemoAdmin123', env.bcryptCost);
  await prisma.user.update({
    where: { id: 1 },
    data: { passwordHash: hash, passwordChangedAt: new Date(), mustChangePassword: 0 },
  });
  console.log('SUPER_ADMIN password reset to DemoAdmin123');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
