import type { AddressInfo } from 'net';
import { createServer } from 'http';
import { io as ioClient, type Socket } from 'socket.io-client';
import { afterEach, describe, expect, it } from 'vitest';

import { attachRealtime, emitAll, emitMarket, emitUser } from '../../src/realtime/hub';
import { api, bearer, loginToken, tokenFor } from '../helpers/app';
import { betLeg, createOpenMarket, createUserWithWallet } from '../helpers/factories';

const open: Array<{ socket?: Socket; close?: () => void }> = [];

afterEach(() => {
  for (const item of open) {
    item.socket?.close();
    item.close?.();
  }
  open.length = 0;
});

async function listen() {
  const httpServer = createServer();
  attachRealtime(httpServer);
  await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', () => resolve()));
  const port = (httpServer.address() as AddressInfo).port;
  const close = () => httpServer.close();
  return { port, close };
}

function connect(port: number, token: string) {
  const socket = ioClient(`http://127.0.0.1:${port}`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
  });
  return socket;
}

describe('realtime sockets', () => {
  it('rejects a connection without a valid token', async () => {
    const { port, close } = await listen();
    const socket = connect(port, 'not-a-token');
    open.push({ socket, close });
    await new Promise<void>((resolve, reject) => {
      socket.on('connect', () => reject(new Error('connected')));
      socket.on('connect_error', () => resolve());
    });
  });

  it('rejects a subscription to another user room', async () => {
    const { user } = await createUserWithWallet(100);
    const other = await createUserWithWallet(100);
    const { port, close } = await listen();
    const socket = connect(port, tokenFor(user.id, 'mobile'));
    open.push({ socket, close });
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    const result = await socket.timeout(2000).emitWithAck('subscribe:user', other.user.id);
    expect(result).toEqual({ ok: false, error: 'FORBIDDEN' });
  });

  it('emits odds only to the subscribed market room', async () => {
    const { user } = await createUserWithWallet(100);
    const { port, close } = await listen();
    const socket = connect(port, tokenFor(user.id, 'mobile'));
    open.push({ socket, close });
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    socket.emit('subscribe:market', 42);
    const event = new Promise<{ type: string; entityId: number }>((resolve) => socket.on('update', resolve));
    await new Promise((resolve) => setTimeout(resolve, 30));
    emitMarket(42, 'odds.updated', { selections: [{ id: 1, currentPrice: 1.5 }] });
    await expect(event).resolves.toMatchObject({ type: 'odds.updated', entityId: 42 });
  });

  it('broadcasts a live event update to a connected user without a market subscription', async () => {
    const { user } = await createUserWithWallet(100);
    const { port, close } = await listen();
    const socket = connect(port, tokenFor(user.id, 'mobile'));
    open.push({ socket, close });
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    const event = new Promise<{ type: string; entityId: number }>((resolve) => socket.on('update', resolve));
    await new Promise((resolve) => setTimeout(resolve, 30));
    emitAll('events.updated', 0);
    await expect(event).resolves.toMatchObject({ type: 'events.updated', entityId: 0 });
  });

  it('does not emit a wallet update when bet placement is rejected', async () => {
    const { user } = await createUserWithWallet(10);
    const { event, market, selections } = await createOpenMarket();
    const token = await loginToken(user.email);
    const { port, close } = await listen();
    const socket = connect(port, token);
    open.push({ socket, close });
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    let walletEvents = 0;
    socket.on('update', (payload: { type: string }) => {
      if (payload.type === 'wallet.updated') walletEvents += 1;
    });
    const res = await api().post('/api/v1/bets').set(bearer(token)).send({ selections: [betLeg(event, market, selections[0])], stake: 5000 });
    expect(res.status).toBe(400);
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(walletEvents).toBe(0);
    expect(emitUser).toBeTypeOf('function');
  });

  it('emits a wallet update after a bet commits', async () => {
    const { user } = await createUserWithWallet(1000);
    const { event, market, selections } = await createOpenMarket();
    const token = await loginToken(user.email);
    const { port, close } = await listen();
    const socket = connect(port, token);
    open.push({ socket, close });
    await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
    const eventPromise = new Promise<{ type: string }>((resolve) => {
      socket.on('update', (payload: { type: string }) => {
        if (payload.type === 'wallet.updated') resolve(payload);
      });
    });
    const res = await api().post('/api/v1/bets').set(bearer(token)).send({ selections: [betLeg(event, market, selections[0])], stake: 25 });
    expect(res.status).toBe(201);
    await expect(eventPromise).resolves.toMatchObject({ type: 'wallet.updated' });
  });
});
