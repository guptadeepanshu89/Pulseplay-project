import type { AddressInfo } from 'net';
import { createServer } from 'http';
import { io as ioClient, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';

import { prisma } from '../../src/db';
import { resetDemo } from '../../src/modules/demo/state';
import { buildReadiness } from '../../src/realtime/health';
import { attachRealtime, closeRealtime, emitUser, realtimeAttached } from '../../src/realtime/hub';
import { allowSocketEvent, noteWorker, socketCorsOrigin, workerSnapshot } from '../../src/realtime/runtime';
import { api, bearer, loginToken, tokenFor } from '../helpers/app';
import { createUserWithWallet } from '../helpers/factories';

const open: Array<{ socket?: Socket; close?: () => void }> = [];

afterEach(() => {
  for (const item of open) {
    item.socket?.close();
    item.close?.();
  }
  open.length = 0;
  resetDemo();
  closeRealtime();
});

async function listen() {
  const httpServer = createServer();
  attachRealtime(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
  const port = (httpServer.address() as AddressInfo).port;
  return { port, close: () => httpServer.close() };
}

function connect(port: number, token: string) {
  return ioClient(`http://127.0.0.1:${port}`, { auth: { token }, transports: ['websocket'], reconnection: false });
}

describe('health and realtime operations', () => {
  it('keeps liveness free of database work and reports readiness from a database probe', async () => {
    const live = await api().get('/health');
    expect(live.status).toBe(200);
    expect(live.body).toEqual({ ok: true, role: 'live' });

    const ready = await api().get('/health/ready');
    expect(ready.status).toBe(200);
    expect(ready.body.database.ok).toBe(true);
    expect(ready.body.socket.adapter).toBe('memory');
    expect(JSON.stringify(ready.body)).not.toMatch(/postgresql:|jwt|apikey/i);

    const down = await buildReadiness({
      attached: false,
      connections: 0,
      probe: async () => {
        throw new Error('postgresql://user:secret@localhost/pulseplay');
      },
    });
    expect(down.status).toBe(503);
    expect(down.body.ok).toBe(false);
    expect(down.body.database.ok).toBe(false);
  });

  it('reports a stalled worker without failing readiness', async () => {
    noteWorker('sportsTicker', 'ok', undefined, new Date(Date.now() - 60_000));
    expect(workerSnapshot().sportsTicker.stale).toBe(true);
    const ready = await buildReadiness({ attached: false, connections: 0, probe: async () => undefined });
    expect(ready.status).toBe(200);
    expect(ready.body.workers.sportsTicker.stale).toBe(true);
  });

  it('limits socket events and closes the server on shutdown', () => {
    const bucket = { start: 0, count: 0 };
    expect(allowSocketEvent(bucket, 1_000, 2)).toBe(true);
    expect(allowSocketEvent(bucket, 1_100, 2)).toBe(true);
    expect(allowSocketEvent(bucket, 1_200, 2)).toBe(false);
    expect(allowSocketEvent(bucket, 12_000, 2)).toBe(true);
  });

  it('requires an explicit CORS allowlist in production', () => {
    const previousNode = process.env.NODE_ENV;
    const previousCors = process.env.SOCKET_CORS_ORIGINS;
    process.env.NODE_ENV = 'production';
    delete process.env.SOCKET_CORS_ORIGINS;
    expect(socketCorsOrigin()).toBe(false);
    process.env.SOCKET_CORS_ORIGINS = 'https://app.example.com, https://admin.example.com';
    expect(socketCorsOrigin()).toEqual(['https://app.example.com', 'https://admin.example.com']);
    process.env.NODE_ENV = previousNode;
    if (previousCors === undefined) delete process.env.SOCKET_CORS_ORIGINS;
    else process.env.SOCKET_CORS_ORIGINS = previousCors;
  });

  it('does not deliver one user demo update to another user or change a wallet', async () => {
    const first = await createUserWithWallet(100);
    const second = await createUserWithWallet(100);
    const firstToken = await loginToken(first.user.email);
    const { port, close } = await listen();
    const firstSocket = connect(port, firstToken);
    const secondSocket = connect(port, tokenFor(second.user.id, 'mobile'));
    open.push({ socket: firstSocket, close }, { socket: secondSocket });
    await Promise.all([
      new Promise<void>((resolve) => firstSocket.on('connect', () => resolve())),
      new Promise<void>((resolve) => secondSocket.on('connect', () => resolve())),
    ]);
    let leaked = 0;
    secondSocket.on('update', (payload: { type: string }) => {
      if (payload.type === 'demo.updated') leaked += 1;
    });
    const received = new Promise<{ seq: number; data?: { version?: number; synthetic?: boolean } }>((resolve) => {
      firstSocket.on('update', (payload) => {
        if (payload.type === 'demo.updated') resolve(payload);
      });
    });

    const before = await prisma.wallet.findUniqueOrThrow({ where: { userId: first.user.id } });
    const betsBefore = await prisma.bet.count({ where: { userId: first.user.id } });
    const snapshot = await api().get('/api/v1/demo/snapshot').set(bearer(firstToken));
    expect(snapshot.status).toBe(200);
    expect(snapshot.body).toMatchObject({ demo: true, synthetic: true, settlesBets: false, version: 1, price: 1.5 });
    const repeat = await api().get('/api/v1/demo/snapshot').set(bearer(firstToken));
    expect(repeat.body).toMatchObject({ version: 1, updatedAt: snapshot.body.updatedAt });
    const tick = await api().post('/api/v1/demo/tick').set(bearer(firstToken));
    expect(tick.status).toBe(200);
    expect(tick.body).toMatchObject({ demo: true, synthetic: true, settlesBets: false, version: 2 });
    const event = await received;
    expect(event.data).toMatchObject({
      demo: true,
      synthetic: true,
      settlesBets: false,
      version: tick.body.version,
      price: tick.body.price,
      updatedAt: tick.body.updatedAt,
    });
    const after = await prisma.wallet.findUniqueOrThrow({ where: { userId: first.user.id } });
    expect(after.availableBalance.toString()).toBe(before.availableBalance.toString());
    expect(await prisma.bet.count({ where: { userId: first.user.id } })).toBe(betsBefore);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(leaked).toBe(0);
    expect(emitUser).toBeTypeOf('function');
  });

  it('rejects an anonymous demo call and a tick body with extra fields', async () => {
    const anon = await api().get('/api/v1/demo/snapshot');
    expect(anon.status).toBe(401);
    expect(anon.body.code).toBe('UNAUTHENTICATED');

    const { user } = await createUserWithWallet(25);
    const token = await loginToken(user.email);
    const invalid = await api().post('/api/v1/demo/tick').set(bearer(token)).send({ price: 99 });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION_ERROR');
    const snapshot = await api().get('/api/v1/demo/snapshot').set(bearer(token));
    expect(snapshot.body.version).toBe(1);
  });

  it('disconnects clients when the realtime server closes', async () => {
    const { user } = await createUserWithWallet(10);
    const { port, close } = await listen();
    const socket = connect(port, tokenFor(user.id, 'mobile'));
    open.push({ socket, close });
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    const disconnected = new Promise<void>((resolve) => socket.on('disconnect', () => resolve()));
    closeRealtime();
    await disconnected;
    expect(realtimeAttached()).toBe(false);
  });
});
