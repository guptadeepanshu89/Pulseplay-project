import { prisma } from '../db';

// Write-side lookup id resolution — e.g. LOOKUP_IDS.BET_STATUS.WON — never a
// hardcoded number. Fully DB-driven on purpose: there is no list of valid
// types/codes anywhere in application code. Whatever rows exist in
// LookupType/Lookup (seeded by a migration — see
// prisma/migrations/*_seed_lookup_reference_data) is what this reflects.
// Adding a brand-new value that no route/worker needs to reference by name
// is just a DB insert (or another migration); no app code change, no
// redeploy. The trade-off: since the exact shape isn't known at compile
// time, `LOOKUP_IDS.SOME_TYPE.SOME_CODE` is not type-checked — a typo here
// surfaces at runtime, not compile time.
//
// Reads never use this cache — the text a client sees comes from querying
// the vw_* database views directly (lib/marketDto.ts, betDto.ts,
// walletDto.ts, notificationDto.ts).
export const LOOKUP_IDS: Record<string, Record<string, number>> = {};

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

async function fetchLookupIds(): Promise<Record<string, Record<string, number>>> {
  const lookups = await prisma.lookup.findMany({ where: { isDeleted: 0 }, include: { lookupType: true } });
  const next: Record<string, Record<string, number>> = {};
  for (const lookup of lookups) {
    const typeCode = lookup.lookupType.code;
    next[typeCode] ??= {};
    next[typeCode][lookup.code] = lookup.id;
  }
  return next;
}

// Called once at boot (index.ts, before app.listen) and once by seed.ts
// before it seeds demo data that references these ids. Throws if the table
// is empty — that means the reference-data migration hasn't run, and
// serving requests against an empty cache would silently write garbage
// (undefined) into every statusId/typeId column.
export async function loadLookupCache(): Promise<void> {
  const next = await fetchLookupIds();
  if (Object.keys(next).length === 0) {
    throw new Error('Lookup cache is empty — has the lookup reference-data migration run?');
  }
  Object.assign(LOOKUP_IDS, next);
}

// A failed refresh is logged and discarded — it never clears or corrupts the
// last-known-good cache, so a transient DB blip can't take down requests
// that are already running fine on the existing values.
export function startLookupCacheRefresh(): void {
  const run = async () => {
    try {
      const next = await fetchLookupIds();
      if (Object.keys(next).length === 0) {
        console.error('[lookupCache] refresh skipped: query returned zero lookups');
      } else {
        Object.assign(LOOKUP_IDS, next);
      }
    } catch (error) {
      console.error('[lookupCache] refresh failed:', error);
    } finally {
      setTimeout(run, REFRESH_INTERVAL_MS);
    }
  };
  setTimeout(run, REFRESH_INTERVAL_MS);
}
