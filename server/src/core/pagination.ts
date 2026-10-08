import { z } from 'zod';

// The list contract every admin list follows (plan §5.7):
//   ?page=1&pageSize=25  →  { items, page, pageSize, total }
// pageSize is capped so one request can't ask for the whole table; page is
// capped so `skip` stays a sane number.

export const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE = 100_000;

// Spread into a `z.strictObject({...})` query schema.
export const pageQueryShape = {
  page: z.coerce.number().int().min(1).max(MAX_PAGE).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
};

export interface PageQuery {
  page: number;
  pageSize: number;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export const skipTake = ({ page, pageSize }: PageQuery) => ({ skip: (page - 1) * pageSize, take: pageSize });

export const pageOf = <T>(items: T[], total: number, { page, pageSize }: PageQuery): Page<T> => ({ items, page, pageSize, total });

export const sortDirection = z.enum(['asc', 'desc']).default('desc');

// `?flag=true|false` → boolean. (z.coerce.boolean would turn the string "false" into true.)
export const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');

// Free-text search box: trimmed, bounded.
export const searchQuery = z.string().trim().min(1).max(100);
