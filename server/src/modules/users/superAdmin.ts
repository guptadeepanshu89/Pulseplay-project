import { randomBytes } from 'crypto';
import { z } from 'zod';

import { prisma } from '../../db';
import { generateTempPassword, hashPassword } from '../../core/password';
import { emailSchema, mobileSchema, nameSchema } from '../../core/validation';
import { ROLE_IDS } from '../../lib/roleCache';

export const createSuperAdminSchema = z.object({ name: nameSchema, email: emailSchema, mobile: mobileSchema });

export type CreateSuperAdminInput = z.input<typeof createSuperAdminSchema>;

export class SuperAdminError extends Error {}

// The only way a SUPER_ADMIN comes into existence: the API deliberately cannot
// mint one (policy `user.create`). Needs the role cache loaded.
//
// The account gets a generated one-time password and must change it at first
// login; the caller shows it exactly once.
export async function createSuperAdmin(input: CreateSuperAdminInput): Promise<{ userId: number; email: string; password: string }> {
  const parsed = createSuperAdminSchema.safeParse(input);
  if (!parsed.success) {
    throw new SuperAdminError(parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; '));
  }
  const { name, email, mobile } = parsed.data;

  // Unique even among soft-deleted rows, so no `isDeleted` filter here.
  const taken = await prisma.user.findFirst({ where: { OR: [{ email }, { mobile }] }, select: { email: true } });
  if (taken) throw new SuperAdminError(`A user with that ${taken.email === email ? 'email' : 'mobile number'} already exists`);

  const password = generateTempPassword();
  const user = await prisma.user.create({
    data: {
      name,
      email,
      mobile,
      userCode: `ID#SA${randomBytes(3).toString('hex').toUpperCase()}`,
      passwordHash: await hashPassword(password),
      roleId: ROLE_IDS.SUPER_ADMIN,
      clientId: null,
      mustChangePassword: 1,
    },
    select: { id: true },
  });

  return { userId: user.id, email, password };
}
