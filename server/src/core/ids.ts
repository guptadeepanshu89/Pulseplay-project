import { AppError } from './errors';

const MAX_INT4 = 2_147_483_647; // ids are Postgres `integer`

// A path parameter that must be a row id. Anything else — "abc", "-1", "1.5",
// "0x10", a number beyond `integer` — is a 400 here, so it never reaches the
// database (where a huge value would surface as a 500).
//
// This is deliberately NOT the 404 an unknown-but-well-formed id gets: a caller
// can only learn "that is not an id", never whether some row exists.
export function idParam(value: string | undefined): number {
  if (value === undefined || !/^\d{1,10}$/.test(value)) throw new AppError(400, 'INVALID_ID', 'Invalid id');
  const id = Number(value);
  if (id < 1 || id > MAX_INT4) throw new AppError(400, 'INVALID_ID', 'Invalid id');
  return id;
}
