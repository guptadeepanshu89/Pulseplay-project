/** Socket/control events that warrant an HTTP resync when a screen is focused. */
export const LIVE_RESYNC_TYPES = [
  'poll',
  'socket.reconnected',
  'app.foreground',
  'snapshot.required',
] as const;

/** Home: recent bets + markets change on place/settle; scores patch via events.updated. */
export const HOME_REFRESH_TYPES = [
  ...LIVE_RESYNC_TYPES,
  'bet.placed',
  'bet.settled',
  'market.settled',
] as const;

/** Markets list: status changes need refetch; odds/scores patch in place. */
export const MARKETS_REFRESH_TYPES = [
  ...LIVE_RESYNC_TYPES,
  'market.settled',
  'market.suspended',
  'market.resumed',
] as const;

/** My Bets: only bet lifecycle + control resync. */
export const BETS_REFRESH_TYPES = [...LIVE_RESYNC_TYPES, 'bet.placed', 'bet.settled'] as const;

/** Global wallet badge/balance: socket only — never poll from inactive screens. */
export const WALLET_SOCKET_TYPES = ['wallet.updated', 'bet.placed', 'bet.settled'] as const;

/** Global notification badge: socket only — list refresh is demand-driven on that screen. */
export const NOTIFICATION_SOCKET_TYPES = ['notification.created'] as const;

export const DEFAULT_LIVE_STALE_MS = 30_000;
export const DEFAULT_REFRESH_DEBOUNCE_MS = 750;

/** Server also emits socket.connected; the client already synthesizes socket.reconnected. */
export function shouldHttpRefresh(eventType: string, refreshTypes: ReadonlySet<string> | readonly string[]): boolean {
  if (eventType === 'socket.connected') return false;
  const allowed = refreshTypes instanceof Set ? refreshTypes : new Set(refreshTypes);
  return allowed.has(eventType);
}

export function isDataStale(lastFetchedAtMs: number, nowMs: number, staleMs: number): boolean {
  if (staleMs <= 0) return true;
  if (lastFetchedAtMs <= 0) return true;
  return nowMs - lastFetchedAtMs >= staleMs;
}

export function createDebouncedRunner(delayMs: number, schedule: (fn: () => void, ms: number) => ReturnType<typeof setTimeout> = setTimeout, cancel: (id: ReturnType<typeof setTimeout>) => void = clearTimeout) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let latest: (() => void) | undefined;

  return {
    schedule(fn: () => void) {
      latest = fn;
      if (timer != null) return;
      timer = schedule(() => {
        timer = undefined;
        const run = latest;
        latest = undefined;
        run?.();
      }, delayMs);
    },
    cancel() {
      latest = undefined;
      if (timer != null) {
        cancel(timer);
        timer = undefined;
      }
    },
  };
}

/** Collapse overlapping identical async work into one in-flight promise. */
export function createInflightDedupe<T>(): (run: () => Promise<T>) => Promise<T> {
  let inflight: Promise<T> | null = null;
  return (run) => {
    if (inflight) return inflight;
    inflight = run().finally(() => {
      inflight = null;
    });
    return inflight;
  };
}

/** Same as createInflightDedupe, but keyed (e.g. per eventId / symbol). */
export function createKeyedInflightDedupe<T>(): (key: string, run: () => Promise<T>) => Promise<T> {
  const inflight = new Map<string, Promise<T>>();
  return (key, run) => {
    const existing = inflight.get(key);
    if (existing) return existing;
    const pending = run().finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, pending);
    return pending;
  };
}
