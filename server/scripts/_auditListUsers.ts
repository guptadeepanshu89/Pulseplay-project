import { prisma } from '../src/db';
import { roleCodeOf } from '../src/lib/roleCache';
import { loadRoleCache } from '../src/lib/roleCache';

async function main() {
  await loadRoleCache();
  const users = await prisma.user.findMany({
    where: { isDeleted: 0 },
    select: { id: true, email: true, mobile: true, roleId: true, isActive: true, mustChangePassword: true },
  });
  for (const u of users) {
    console.log(JSON.stringify({ ...u, role: roleCodeOf(u.roleId) }));
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
