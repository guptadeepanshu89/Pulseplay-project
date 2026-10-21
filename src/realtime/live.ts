import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { io, Socket } from 'socket.io-client';

import { getToken } from '../api/client';
import { createLivePoll, LIVE_POLL_MS } from './pollLoop';
import { reduceSequence, type SequenceState } from './sequence';

export { LIVE_POLL_MS };

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

export function shouldPoll(input: { socketConnected: boolean; screenActive: boolean; appActive: boolean }): boolean {
  return input.screenActive && input.appActive && !input.socketConnected;
}

export function socketServerUrl(): string {
  const explicit = process.env.EXPO_PUBLIC_SOCKET_URL?.replace(/\/$/, '') ?? '';
  if (explicit) return explicit;
  const api = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
  const fromApi = api.replace(/\/api\/v1$/, '');
  if (fromApi) return fromApi;
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:4000';
  }
  return '';
}

type Handler = (event: LiveEvent) => void;

let socket: Socket | null = null;
let connecting: Promise<Socket | null> | null = null;
let sequence: SequenceState = { last: null, instanceId: null };
let connectionState: ConnectionState = 'disconnected';
const handlers = new Set<Handler>();
const stateListeners = new Set<(state: ConnectionState) => void>();

function setConnectionState(next: ConnectionState): void {
  connectionState = next;
  stateListeners.forEach((listener) => listener(next));
}

export function currentConnectionState(): ConnectionState {
  return connectionState;
}

/** Drop the singleton after logout so the next login opens a fresh authenticated socket. */
export function disconnectLive(): void {
  connecting = null;
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
  if (!url) return null;
  if (socket) return socket;
  if (connecting) return connecting;
  connecting = (async () => {
    const token = await getToken();
    setConnectionState('connecting');
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
      handlers.forEach((handler) => handler({ type: 'socket.reconnected', entityId: 0 }));
    });
    next.on('disconnect', () => setConnectionState('reconnecting'));
    next.io.on('reconnect_attempt', () => setConnectionState('reconnecting'));
    socket = next;
    return next;
  })().finally(() => {
    connecting = null;
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

export function subscribeLive(options: { marketIds?: number[]; onUpdate: Handler }): () => void {
  handlers.add(options.onUpdate);
  const poll = createLivePoll({
    onUpdate: options.onUpdate,
    connected: () => Boolean(socket?.connected),
    appActive: AppState.currentState === 'active',
  });

  const appSub = AppState.addEventListener('change', (state) => {
    poll.setAppActive(state === 'active');
  });

  let stopped = false;
  void ensureSocket().then((sock) => {
    if (stopped) return;
    for (const id of options.marketIds ?? []) sock?.emit('subscribe:market', id);
    sock?.on('connect', poll.sync);
    sock?.on('disconnect', poll.sync);
    poll.sync();
  });

  return () => {
    stopped = true;
    poll.stop();
    handlers.delete(options.onUpdate);
    appSub.remove();
    socket?.off('connect', poll.sync);
    socket?.off('disconnect', poll.sync);
    for (const id of options.marketIds ?? []) socket?.emit('unsubscribe:market', id);
  };
}

export function useLiveRefresh(
  refresh: () => void | Promise<void>,
  marketIds: number[] = [],
  onOdds?: (event: LiveEvent) => void,
  onEvent?: (event: LiveEvent) => void | boolean,
): void {
  const refreshRef = useRef(refresh);
  const oddsRef = useRef(onOdds);
  const eventRef = useRef(onEvent);
  const ids = marketIds.join(',');

  useEffect(() => {
    refreshRef.current = refresh;
    oddsRef.current = onOdds;
    eventRef.current = onEvent;
  }, [refresh, onOdds, onEvent]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const run = () => {
        if (alive) void refreshRef.current();
      };
      const stop = subscribeLive({
        marketIds: ids ? ids.split(',').map(Number) : [],
        onUpdate: (event) => {
          if (event.type === 'odds.updated') {
            oddsRef.current?.(event);
            return;
          }
          if (eventRef.current?.(event) === true) return;
          run();
        },
      });
      return () => {
        alive = false;
        stop();
      };
    }, [ids]),
  );
}

export function useAlwaysLive(refresh: () => void | Promise<void>, types: string[]): void {
  const refreshRef = useRef(refresh);
  const key = types.join(',');

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    const allowed = new Set(key ? key.split(',') : []);
    return subscribeLive({
      onUpdate: (event) => {
        if (allowed.has(event.type)) void refreshRef.current();
      },
    });
  }, [key]);
}
