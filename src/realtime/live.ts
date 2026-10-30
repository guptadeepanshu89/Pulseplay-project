import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';

import { getToken } from '../api/client';
import { normalizeLiveRefreshArgs, type LiveRefreshOptions } from './liveRefreshArgs';
import {
  createDebouncedRunner,
  DEFAULT_REFRESH_DEBOUNCE_MS,
  isDataStale,
  LIVE_RESYNC_TYPES,
  shouldHttpRefresh,
} from './liveRefreshPolicy';
import { marketRoomDiff } from './marketRooms';
import { createLivePoll, LIVE_POLL_MS, shouldPoll } from './pollLoop';
import { resolveSocketServerUrl } from './resolveSocketServerUrl';
import { reduceSequence, type SequenceState } from './sequence';

export { LIVE_POLL_MS };
export { normalizeLiveRefreshArgs, type LiveRefreshOptions } from './liveRefreshArgs';
export {
  BETS_REFRESH_TYPES,
  DEFAULT_LIVE_STALE_MS,
  HOME_REFRESH_TYPES,
  LIVE_RESYNC_TYPES,
  MARKETS_REFRESH_TYPES,
  NOTIFICATION_SOCKET_TYPES,
  WALLET_SOCKET_TYPES,
} from './liveRefreshPolicy';

export interface LiveEvent {
  type: string;
  entityId: number;
  timestamp?: string;
  seq?: number;
  instanceId?: string;
  data?: {
    selections?: { id: number; currentPrice: number; priceVersion?: number }[];
    version?: number;
    price?: number;
    updatedAt?: string;
    demo?: boolean;
    synthetic?: boolean;
    settlesBets?: boolean;
    symbol?: string;
    provider?: string;
    asOf?: string;
    matchId?: string;
    status?: string;
    score?: string;
    adapter?: string;
    instanceId?: string;
  };
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export { shouldPoll };

export function socketServerUrl(): string {
  return resolveSocketServerUrl({
    platform: Platform.OS,
    windowHostname: typeof window !== 'undefined' ? window.location.hostname : undefined,
    expoPublicSocketUrl: process.env.EXPO_PUBLIC_SOCKET_URL,
    expoPublicApiUrl: process.env.EXPO_PUBLIC_API_URL,
  });
}

type Handler = (event: LiveEvent) => void;

let socket: Socket | null = null;
let connecting: Promise<Socket | null> | null = null;
let boundSocketUrl: string | null = null;
let sequence: SequenceState = { last: null, instanceId: null };
let connectionState: ConnectionState = 'disconnected';
const handlers = new Set<Handler>();
const stateListeners = new Set<(state: ConnectionState) => void>();

function logSocketDev(message: string, fields: Record<string, string>): void {
  if (__DEV__) console.info(`[live] ${message}`, fields);
}

function setConnectionState(next: ConnectionState): void {
  connectionState = next;
  stateListeners.forEach((listener) => listener(next));
}

export function currentConnectionState(): ConnectionState {
  return connectionState;
}

export function isSocketConnected(): boolean {
  return Boolean(socket?.connected);
}

export function currentSocketTargetUrl(): string | null {
  return boundSocketUrl;
}

/** Drop the singleton after logout so the next login opens a fresh authenticated socket. */
export function disconnectLive(): void {
  connecting = null;
  boundSocketUrl = null;
  sequence = { last: null, instanceId: null };
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  setConnectionState('disconnected');
}

/** Rebuild the socket with the current token (call after login). */
export async function reconnectLive(): Promise<void> {
  disconnectLive();
  await ensureSocket();
}

async function ensureSocket(): Promise<Socket | null> {
  const url = socketServerUrl();
  if (!url) {
    setConnectionState('disconnected');
    return null;
  }
  if (socket && boundSocketUrl && boundSocketUrl !== url) {
    logSocketDev('socket url changed; reconnecting', { from: boundSocketUrl, to: url });
    disconnectLive();
  }
  if (socket) return socket;
  if (connecting) return connecting;

  const open = (async (): Promise<Socket | null> => {
    const token = await getToken();
    setConnectionState('connecting');
    logSocketDev('connecting', { url, path: '/socket.io' });
    boundSocketUrl = url;
    const next = io(url, {
      path: '/socket.io',
      auth: token ? { token } : {},
      withCredentials: true,
      reconnection: true,
      reconnectionDelay: Number(process.env.EXPO_PUBLIC_SOCKET_RECONNECT_MS ?? 1000),
      reconnectionDelayMax: 10_000,
    });
    next.on('update', (event: LiveEvent) => {
      const decision = reduceSequence(sequence, event);
      sequence = decision.state;
      if (decision.action === 'ignore') return;
      handlers.forEach((handler) => handler(event));
      if (decision.action === 'resync') handlers.forEach((handler) => handler({ type: 'snapshot.required', entityId: 0 }));
    });
    next.on('connect', () => {
      sequence = { last: null, instanceId: sequence.instanceId };
      setConnectionState('connected');
      logSocketDev('connected', { url: boundSocketUrl ?? url });
      handlers.forEach((handler) => handler({ type: 'socket.reconnected', entityId: 0 }));
    });
    next.on('connect_error', () => setConnectionState('reconnecting'));
    next.on('disconnect', () => setConnectionState('reconnecting'));
    next.io.on('reconnect_attempt', () => setConnectionState('reconnecting'));
    next.io.on('reconnect_failed', () => setConnectionState('disconnected'));
    socket = next;
    return next;
  })();

  connecting = open.finally(() => {
    if (connecting === open) connecting = null;
  });
  return connecting;
}

export function useConnectionState(): ConnectionState {
  const [state, setState] = useState(connectionState);
  useEffect(() => {
    stateListeners.add(setState);
    void ensureSocket().then((sock) => {
      if (!sock) setConnectionState('disconnected');
    });
    return () => {
      stateListeners.delete(setState);
    };
  }, []);
  return state;
}

export interface LiveSubscription {
  stop: () => void;
  setMarketIds: (ids: number[]) => void;
}

/**
 * Keep desired room membership in memory even while the socket is down.
 * `joinedMarketIds` tracks emits on the current connection; reset to [] on
 * every connect so reconnect re-subscribes without duplicating while connected.
 */
export function subscribeLive(options: {
  marketIds?: number[];
  onUpdate: Handler;
  /** HTTP poll fallback while socket is down. Off for global providers (socket events only). */
  pollFallback?: boolean;
}): LiveSubscription {
  handlers.add(options.onUpdate);
  const pollFallback = options.pollFallback !== false;
  const poll = pollFallback
    ? createLivePoll({
        onUpdate: options.onUpdate,
        connected: () => Boolean(socket?.connected),
        appActive: AppState.currentState === 'active',
      })
    : null;

  const appSub = poll
    ? AppState.addEventListener('change', (state) => {
        poll.setAppActive(state === 'active');
      })
    : null;

  let stopped = false;
  let desiredMarketIds = [...(options.marketIds ?? [])];
  let joinedMarketIds: number[] = [];

  const syncMarketRooms = (sock: Socket | null) => {
    if (!sock?.connected) return;
    const { subscribe, unsubscribe } = marketRoomDiff(joinedMarketIds, desiredMarketIds);
    for (const id of unsubscribe) sock.emit('unsubscribe:market', id);
    for (const id of subscribe) sock.emit('subscribe:market', id);
    joinedMarketIds = [...desiredMarketIds];
  };

  const onSocketConnect = () => {
    // Server drops room membership on reconnect — force a full re-subscribe.
    joinedMarketIds = [];
    syncMarketRooms(socket);
    poll?.sync();
  };

  void ensureSocket().then((sock) => {
    if (stopped) return;
    sock?.on('connect', onSocketConnect);
    if (poll) {
      sock?.on('disconnect', poll.sync);
    }
    if (sock?.connected) {
      syncMarketRooms(sock);
      poll?.sync();
    } else {
      poll?.sync();
    }
  });

  return {
    setMarketIds(ids: number[]) {
      if (stopped) return;
      desiredMarketIds = [...ids];
      // If the socket is not up yet, desired ids are applied on the next connect.
      syncMarketRooms(socket);
    },
    stop() {
      stopped = true;
      poll?.stop();
      handlers.delete(options.onUpdate);
      appSub?.remove();
      socket?.off('connect', onSocketConnect);
      if (poll) {
        socket?.off('disconnect', poll.sync);
      }
      desiredMarketIds = [];
      syncMarketRooms(socket);
      joinedMarketIds = [];
    },
  };
}

export function useLiveRefresh(refresh: () => void | Promise<void>, options?: LiveRefreshOptions): void;
export function useLiveRefresh(
  refresh: () => void | Promise<void>,
  marketIds: number[],
  onOdds?: (event: LiveEvent) => void,
  onEvent?: (event: LiveEvent) => void | boolean,
): void;
export function useLiveRefresh(
  refresh: () => void | Promise<void>,
  optionsOrMarketIds: LiveRefreshOptions | number[] = {},
  onOdds?: (event: LiveEvent) => void,
  onEvent?: (event: LiveEvent) => void | boolean,
): void {
  const options = normalizeLiveRefreshArgs(optionsOrMarketIds, onOdds, onEvent);
  const {
    marketIds = [],
    onOdds: oddsHandler,
    onEvent: eventHandler,
    refreshTypes = LIVE_RESYNC_TYPES,
    staleMs,
    debounceMs = DEFAULT_REFRESH_DEBOUNCE_MS,
  } = options;
  const refreshRef = useRef(refresh);
  const oddsRef = useRef(oddsHandler);
  const eventRef = useRef(eventHandler);
  const lastFetchRef = useRef(0);
  const marketIdsRef = useRef(marketIds);
  const setMarketIdsRef = useRef<((ids: number[]) => void) | null>(null);
  const ids = marketIds.join(',');
  const typesKey = refreshTypes.join(',');

  useEffect(() => {
    refreshRef.current = refresh;
    oddsRef.current = oddsHandler;
    eventRef.current = eventHandler;
  }, [refresh, oddsHandler, eventHandler]);

  useEffect(() => {
    marketIdsRef.current = ids ? ids.split(',').map(Number) : [];
    // Update rooms while focused without tearing down the subscription / stale refresh.
    setMarketIdsRef.current?.(marketIdsRef.current);
  }, [ids]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const allowed = new Set(typesKey ? typesKey.split(',') : [...LIVE_RESYNC_TYPES]);
      const debounced = createDebouncedRunner(debounceMs);

      const run = () => {
        if (!alive) return;
        void Promise.resolve(refreshRef.current()).finally(() => {
          // Record even after blur so a marketIds-driven remount does not immediately refetch.
          lastFetchRef.current = Date.now();
        });
      };

      if (staleMs != null && isDataStale(lastFetchRef.current, Date.now(), staleMs)) {
        run();
      }

      const sub = subscribeLive({
        marketIds: marketIdsRef.current,
        pollFallback: true,
        onUpdate: (event) => {
          if (!alive) return;
          if (event.type === 'odds.updated') {
            oddsRef.current?.(event);
            return;
          }
          if (eventRef.current?.(event) === true) return;
          if (!shouldHttpRefresh(event.type, allowed)) return;
          debounced.schedule(run);
        },
      });
      setMarketIdsRef.current = sub.setMarketIds;

      return () => {
        alive = false;
        setMarketIdsRef.current = null;
        debounced.cancel();
        sub.stop();
      };
      // marketIds intentionally omitted — room membership syncs via setMarketIds above.
    }, [typesKey, staleMs, debounceMs]),
  );
}

/** Global providers: socket entity events only — no poll / reconnect HTTP thrash. */
export function useAlwaysLive(refresh: () => void | Promise<void>, types: string[]): void {
  const refreshRef = useRef(refresh);
  const key = types.join(',');

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const allowed = new Set(key ? key.split(',') : []);
    const sub = subscribeLive({
      pollFallback: false,
      onUpdate: (event) => {
        if (allowed.has(event.type)) void refreshRef.current();
      },
    });
    return () => sub.stop();
  }, [key]);
}
