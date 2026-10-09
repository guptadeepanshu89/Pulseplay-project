import { z } from 'zod';

import { Actor } from '../../core/actor';
import { pageQueryShape } from '../../core/pagination';

const amountSchema = z
  .number()
  .positive('Amount must be greater than zero')
  .max(999_999_999_999.99, 'Amount is too large')
  .refine((amount) => Math.abs(Math.round(amount * 100) - amount * 100) < 1e-6, 'Amount may have at most 2 decimal places');

export const createFundRequestSchema = z.strictObject({
  type: z.enum(['INCREASE', 'DECREASE']),
  amount: amountSchema,
  reason: z.string().trim().max(500, 'Reason must be at most 500 characters').default(''),
});
export type CreateFundRequestInput = z.infer<typeof createFundRequestSchema>;

const listShape = {
  ...pageQueryShape,
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  userId: z.coerce.number().int().positive().optional(),
};

// Only a SuperAdmin may narrow by client — a Client Admin's list is always their own.
export const listFundRequestsQueryFor = (actor: Actor) =>
  actor.role === 'SUPER_ADMIN'
    ? z.strictObject({ ...listShape, clientId: z.coerce.number().int().positive().optional() })
    : z.strictObject(listShape);
export type ListFundRequestsQuery = z.infer<ReturnType<typeof listFundRequestsQueryFor>> & { clientId?: number };
