import { z } from 'zod';

import { newPasswordSchema } from '../../core/password';

const app = z.enum(['mobile', 'admin']);

export const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).max(254),
    password: z.string().min(1).max(200),
    // Existing mobile builds don't send it, so it defaults to the mobile app.
    app: app.default('mobile'),
  })
  .strict();

export const logoutSchema = z.object({ app: app.default('mobile') }).strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: newPasswordSchema,
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    identifier: z.string().trim().min(1).max(254),
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(1).max(200),
    newPassword: newPasswordSchema,
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;
