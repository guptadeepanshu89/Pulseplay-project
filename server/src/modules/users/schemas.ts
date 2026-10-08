import { z } from 'zod';

import { Actor } from '../../core/actor';
import { booleanQuery, pageQueryShape, searchQuery, sortDirection } from '../../core/pagination';
import { emailSchema, mobileSchema, nameSchema } from '../../core/validation';

const clientIdSchema = z.number().int().positive();

// The account being created. Only a SuperAdmin names the client (a Client Admin's
// own client is implied): for anyone else `clientId` is not part of the schema at
// all, so sending it is a 400 like any other unknown key.
const newUserShape = {
  name: nameSchema,
  email: emailSchema,
  mobile: mobileSchema,
  role: z.enum(['CLIENT_ADMIN', 'CLIENT_USER']).default('CLIENT_USER'),
};

export interface CreateUserInput {
  name: string;
  email: string;
  mobile: string;
  role: 'CLIENT_ADMIN' | 'CLIENT_USER';
  clientId?: number;
}

export const createUserSchemaFor = (actor: Actor): z.ZodType<CreateUserInput> =>
  actor.role === 'SUPER_ADMIN' ? z.strictObject({ ...newUserShape, clientId: clientIdSchema }) : z.strictObject(newUserShape);

// Role and client are fixed at creation and are not editable — so they are not here.
export const updateUserSchema = z
  .strictObject({ name: nameSchema, email: emailSchema, mobile: mobileSchema })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to change');
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const noBodySchema = z.strictObject({});

const listShape = {
  ...pageQueryShape,
  search: searchQuery.optional(),
  role: z.enum(['CLIENT_ADMIN', 'CLIENT_USER']).optional(),
  isActive: booleanQuery.optional(),
  sort: z.enum(['createdAt', 'name', 'email', 'lastLoginAt']).default('createdAt'),
  order: sortDirection,
};

// A Client Admin's list is always their own client, so `clientId` is only accepted from a SuperAdmin.
export const listUsersQueryFor = (actor: Actor) =>
  actor.role === 'SUPER_ADMIN'
    ? z.strictObject({ ...listShape, clientId: z.coerce.number().int().positive().optional() })
    : z.strictObject(listShape);

export type ListUsersQuery = z.infer<ReturnType<typeof listUsersQueryFor>> & { clientId?: number };
