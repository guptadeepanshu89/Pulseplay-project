import type { Server as HttpServer } from 'http';
import { Server, type Socket } from 'socket.io';

import { verifyToken } from '../core/tokens';
import { allowSocketEvent, nextRealtimeSeq, socketAdapterMode, socketCorsOrigin, socketLimits } from './runtime';

export interface RealtimeMessage {
  type: string;
  entityId: number;
  timestamp: string;
  seq: number;
  data?: Record<string, unknown>;
}

let io: Server | null = null;
let connections = 0;

function tokenFromCookie(header: unknown): string | null {
  if (typeof header !== 'string') return null;
  for (const name of ['pulseplay_token', 'pulseplay_admin_token']) {
    const matched = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    if (matched?.[1]) return decodeURIComponent(matched[1]);
  }
  return null;
}

function message(type: string, entityId: number, data?: Record<string, unknown>): RealtimeMessage {
  return { type, entityId, timestamp: new Date().toISOString(), seq: nextRealtimeSeq(), ...(data ? { data } : {}) };
}

function log(event: string, fields: Record<string, string | number | boolean | null>): void {
  console.info(JSON.stringify({ scope: 'realtime', event, time: new Date().toISOString(), ...fields }));
}

export function attachRealtime(httpServer: HttpServer): Server {
  if (io) {
    io.close();
    io = null;
    connections = 0;
  }
  const limits = socketLimits();
  socketAdapterMode();
  io = new Server(httpServer, {
    cors: { origin: socketCorsOrigin(), credentials: true },
    path: '/socket.io',
    pingInterval: limits.pingIntervalMs,
    pingTimeout: limits.pingTimeoutMs,
  });

  io.use((socket, next) => {
    if (connections >= limits.maxConnections) {
      log('connection.rejected', { reason: 'limit' });
      next(new Error('TOO_MANY_CONNECTIONS'));
      return;
    }
    const raw = socket.handshake.auth?.token;
    const claims = (typeof raw === 'string' ? verifyToken(raw) : null) ?? verifyToken(tokenFromCookie(socket.handshake.headers.cookie) ?? '');
    if (!claims) {
      log('connection.rejected', { reason: 'unauthorized' });
      next(new Error('UNAUTHORIZED'));
      return;
    }
    socket.data.userId = claims.userId;
    socket.data.app = claims.app;
    next();
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as number;
    const connectedAt = Date.now();
    connections += 1;
    socket.join(`user:${userId}`);
    socket.data.rate = { start: connectedAt, count: 0 };
    log('connection.open', { userId, connections });

    const guarded = (handler: (payload: unknown, ack?: (result: { ok: boolean; error?: string }) => void) => void) => {
      return (payload: unknown, ack?: (result: { ok: boolean; error?: string }) => void) => {
        const bucket = socket.data.rate as { start: number; count: number };
        if (!allowSocketEvent(bucket, Date.now(), limits.eventsPer10s)) {
          log('event.limited', { userId });
          ack?.({ ok: false, error: 'RATE_LIMITED' });
          return;
        }
        try {
          handler(payload, ack);
        } catch (error) {
          log('event.error', { userId, message: error instanceof Error ? error.name : 'error' });
          ack?.({ ok: false, error: 'INVALID_EVENT' });
        }
      };
    };

    socket.on('subscribe:user', guarded((requestedId, ack) => {
      const id = Number(requestedId);
      if (!Number.isInteger(id) || id !== userId) {
        ack?.({ ok: false, error: 'FORBIDDEN' });
        return;
      }
      ack?.({ ok: true });
    }));

    socket.on('subscribe:market', guarded((marketId, ack) => {
      const id = Number(marketId);
      if (!Number.isInteger(id) || id <= 0) {
        ack?.({ ok: false, error: 'INVALID_MARKET' });
        return;
      }
      socket.join(`market:${id}`);
      ack?.({ ok: true });
    }));

    socket.on('unsubscribe:market', guarded((marketId, ack) => {
      const id = Number(marketId);
      if (!Number.isInteger(id) || id <= 0) {
        ack?.({ ok: false, error: 'INVALID_MARKET' });
        return;
      }
      socket.leave(`market:${id}`);
      ack?.({ ok: true });
    }));

    socket.on('disconnect', (reason) => {
      connections = Math.max(0, connections - 1);
      log('connection.close', { userId, reason, durationMs: Date.now() - connectedAt, connections });
    });
  });

  return io;
}

export function emitUser(userId: number, type: string, entityId: number, data?: Record<string, unknown>): void {
  io?.to(`user:${userId}`).emit('update', message(type, entityId, data));
}

export function emitMarket(marketId: number, type: string, data?: Record<string, unknown>): void {
  io?.to(`market:${marketId}`).emit('update', message(type, marketId, data));
}

export function emitAll(type: string, entityId: number, data?: Record<string, unknown>): void {
  io?.emit('update', message(type, entityId, data));
}

export function realtimeAttached(): boolean {
  return io !== null;
}

export function realtimeConnections(): number {
  return connections;
}

export function closeRealtime(): void {
  io?.close();
  io = null;
  connections = 0;
}
