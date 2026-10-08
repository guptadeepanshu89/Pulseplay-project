import { z } from 'zod';

import { booleanQuery, pageQueryShape, searchQuery, sortDirection } from '../../core/pagination';
import { emailSchema, mobileSchema, nameSchema } from '../../core/validation';

// Set once at creation, never edited (CL-07): a client's own row lookups (fund
// requests, wallet requests) and its URL slugs use it, so changing it later
// would be a silent break for anything that cached it.
export const clientCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9_-]{2,20}$/, 'Code must be 2–20 characters: letters, numbers, "_" or "-"');

// A Client is created together with its first Client Admin, in one transaction
// (§5.6): a Client with nobody able to approve its users' requests is useless.
export const createClientSchema = z.strictObject({
  code: clientCodeSchema,
  name: nameSchema,
  admin: z.strictObject({ name: nameSchema, email: emailSchema, mobile: mobileSchema }),
});
export type CreateClientInput = z.infer<typeof createClientSchema>;

export const updateClientSchema = z.strictObject({ name: nameSchema });
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

export const listClientsQuery = z.strictObject({
  ...pageQueryShape,
  search: searchQuery.optional(),
  isActive: booleanQuery.optional(),
  sort: z.enum(['createdAt', 'name', 'code']).default('createdAt'),
  order: sortDirection,
});
export type ListClientsQuery = z.infer<typeof listClientsQuery>;
