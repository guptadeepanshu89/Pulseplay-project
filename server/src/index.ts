import { createApp } from './app';
import { env } from './env';
import { loadLookupCache, startLookupCacheRefresh } from './lib/lookupCache';
import { loadRoleCache } from './lib/roleCache';
import { startSportsTicker } from './workers/sportsTicker';
import { startCryptoFeed } from './workers/cryptoFeed';
import { startFixturesSync } from './workers/fixturesSync';

// Routes resolve status/type/category values via the in-memory lookup cache
// (see lib/lookupCache.ts) — it must be populated before the server accepts
// any request, so this can't just be a listen() callback side effect.
async function main() {
  await loadLookupCache();
  await loadRoleCache();
  createApp().listen(env.port, () => {
    console.log(`PulsePlay API listening on http://localhost:${env.port}`);
    startLookupCacheRefresh();
    startSportsTicker();
    startCryptoFeed();
    startFixturesSync();
  });
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
