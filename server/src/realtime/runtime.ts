export interface WorkerBeat {
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
  runs: number;
  failures: number;
}

export interface ProviderBeat {
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastError: string | null;
}

const workers = new Map<string, WorkerBeat>();
const providers = new Map<string, ProviderBeat>();
const http = { requests: 0, errors: 0, totalMs: 0 };

let workersEnabled = true;
let seq = 0;

const STALE_MS: Record<string, number> = {
  sportsTicker: positiveEnv('SPORTS_TICKER_STALE_MS', 30_000),
  cryptoFeed: positiveEnv('CRYPTO_FEED_STALE_MS', 90_000),
  fixturesSync: positiveEnv('FIXTURES_SYNC_STALE_MS', 20 * 60_000),
  cricket: positiveEnv('CRICKET_STALE_MS', 10 * 60_000),
  crypto: positiveEnv('CRYPTO_PROVIDER_STALE_MS', 90_000),
};

function positiveEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function workersAcceptTicks(): boolean {
  return workersEnabled;
}

export function stopWorkers(): void {
  workersEnabled = false;
}

export function nextRealtimeSeq(): number {
  seq += 1;
  return seq;
}

export function noteWorker(name: string, result: 'ok' | 'error', error?: unknown, at = new Date()): void {
  const current = workers.get(name) ?? { lastSuccessAt: null, lastErrorAt: null, lastError: null, runs: 0, failures: 0 };
  current.runs += 1;
  if (result === 'ok') current.lastSuccessAt = at.toISOString();
  else {
    current.failures += 1;
    current.lastErrorAt = at.toISOString();
    current.lastError = safeError(error);
  }
  workers.set(name, current);
}

export function noteProvider(name: string, result: 'ok' | 'error', error?: unknown, at = new Date()): void {
  const current = providers.get(name) ?? { lastSuccessAt: null, lastErrorAt: null, lastError: null };
  if (result === 'ok') current.lastSuccessAt = at.toISOString();
  else {
    current.lastErrorAt = at.toISOString();
    current.lastError = safeError(error);
  }
  providers.set(name, current);
}

export function noteHttp(status: number, elapsedMs: number): void {
  http.requests += 1;
  http.totalMs += elapsedMs;
  if (status >= 500) http.errors += 1;
}

export function httpMetrics(): { requests: number; errors: number; averageMs: number } {
  return {
    requests: http.requests,
    errors: http.errors,
    averageMs: http.requests === 0 ? 0 : Math.round(http.totalMs / http.requests),
  };
}

export function workerSnapshot(now = new Date()): Record<string, WorkerBeat & { stale: boolean; running: boolean }> {
  const names = ['sportsTicker', 'cryptoFeed', 'fixturesSync'];
  return Object.fromEntries(
    names.map((name) => {
      const beat = workers.get(name) ?? { lastSuccessAt: null, lastErrorAt: null, lastError: null, runs: 0, failures: 0 };
      return [name, { ...beat, running: beat.runs > 0, stale: isStale(name, beat.lastSuccessAt, now) }];
    }),
  );
}

export function providerSnapshot(now = new Date()): Record<string, ProviderBeat & { configured: boolean; fresh: boolean; stale: boolean }> {
  return {
    cricket: providerView('cricket', Boolean(process.env.CRICKET_API_KEY), now),
    crypto: providerView('crypto', true, now),
  };
}

export function processSnapshot(): { uptimeSeconds: number; rssMb: number; heapUsedMb: number } {
  const memory = process.memoryUsage();
  return {
    uptimeSeconds: Math.round(process.uptime()),
    rssMb: Math.round(memory.rss / 1024 / 1024),
    heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
  };
}

export function socketCorsOrigin(): true | string[] {
  const raw = process.env.SOCKET_CORS_ORIGINS?.trim();
  if (!raw) return true;
  const origins = raw.split(',').map((origin) => origin.trim()).filter(Boolean);
  return origins.length > 0 ? origins : true;
}

export function socketAdapterMode(): 'memory' {
  if (process.env.SOCKET_REDIS_URL) {
    console.warn('[realtime] SOCKET_REDIS_URL is set, but no Redis adapter is installed. This process keeps the in-memory adapter.');
  }
  return 'memory';
}

export function socketLimits(): { maxConnections: number; pingIntervalMs: number; pingTimeoutMs: number; eventsPer10s: number } {
  return {
    maxConnections: positiveEnv('SOCKET_MAX_CONNECTIONS', 2000),
    pingIntervalMs: positiveEnv('SOCKET_PING_INTERVAL_MS', 25_000),
    pingTimeoutMs: positiveEnv('SOCKET_PING_TIMEOUT_MS', 20_000),
    eventsPer10s: positiveEnv('SOCKET_EVENTS_PER_10S', 30),
  };
}

export function allowSocketEvent(bucket: { start: number; count: number }, now: number, limit: number, windowMs = 10_000): boolean {
  if (now - bucket.start >= windowMs) {
    bucket.start = now;
    bucket.count = 0;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

function providerView(name: string, configured: boolean, now: Date): ProviderBeat & { configured: boolean; fresh: boolean; stale: boolean } {
  const beat = providers.get(name) ?? { lastSuccessAt: null, lastErrorAt: null, lastError: null };
  const stale = configured && isStale(name, beat.lastSuccessAt, now) && beat.lastSuccessAt !== null;
  return { ...beat, configured, fresh: Boolean(beat.lastSuccessAt) && !stale, stale };
}

function isStale(name: string, lastSuccessAt: string | null, now: Date): boolean {
  if (!lastSuccessAt) return false;
  return now.getTime() - Date.parse(lastSuccessAt) > (STALE_MS[name] ?? 60_000);
}

export function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'error';
  return message
    .replace(/apikey=[^&\s]+/gi, 'apikey=redacted')
    .replace(/postgres(?:ql)?:\/\/\S+/gi, 'postgresql://redacted')
    .replace(/Bearer\s+\S+/gi, 'Bearer redacted')
    .slice(0, 180);
}
