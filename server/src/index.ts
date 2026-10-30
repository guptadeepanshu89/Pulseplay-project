import { createApp } from './app';
import { env } from './env';
import { attachRealtime, closeRealtime } from './realtime/hub';
import { stopWorkers } from './realtime/runtime';
import { loadLookupCache, startLookupCacheRefresh } from './lib/lookupCache';
import { loadRoleCache } from './lib/roleCache';
import { startSportsTicker } from './workers/sportsTicker';
import { startBybitSpotStream, stopBybitSpotStream } from './modules/crypto/bybitSpotStream';
import { startCryptoFeed } from './workers/cryptoFeed';
import { startFixturesSync } from './workers/fixturesSync';
import { warnCricketConfig } from './modules/cricket/provider';

// Routes resolve status/type/category values via the in-memory lookup cache
// (see lib/lookupCache.ts) — it must be populated before the server accepts
// any request, so this can't just be a listen() callback side effect.
async function main() {
  await loadLookupCache();
  await loadRoleCache();
  const server = createApp().listen(env.port, () => {
    warnCricketConfig();
    console.log(`PulsePlay API listening on http://localhost:${env.port}`);
    attachRealtime(server);
    startLookupCacheRefresh();
    startSportsTicker();
    startBybitSpotStream();
    startCryptoFeed();
    startFixturesSync();
  });

  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) return;
    closing = true;
    console.info(JSON.stringify({ scope: 'process', event: 'shutdown', signal }));
    stopWorkers();
    stopBybitSpotStream();
    closeRealtime();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
