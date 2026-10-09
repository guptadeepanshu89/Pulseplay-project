import { describe, expect, it } from 'vitest';

import { api, sessionFor } from '../helpers/app';
import { prisma } from '../helpers/db';
import { createClient, createUser, createUserWithWallet } from '../helpers/factories';

async function playerWithAdmin(available = 1000) {
  const client = await createClient();
  const { user: player, wallet } = await createUserWithWallet(available, 0, { clientId: client.id });
  const admin = await createUser({ role: 'CLIENT_ADMIN', clientId: client.id });
  return { client, player, wallet, admin, adminSession: sessionFor(admin.id, 'admin'), playerToken: sessionFor(player.id, 'mobile') };
}

const request = (headers: Record<string, string>, body: Record<string, unknown>) =>
  api().post('/api/v1/wallet/requests').set(headers).send(body);

describe('FR-04 — at most 5 pending requests per player', () => {
  it('the 6th is rejected; approving one frees a slot', async () => {
    const { adminSession, playerToken } = await playerWithAdmin();
    const ids: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const res = await request(playerToken, { type: 'INCREASE', amount: 10, reason: `r${i}` });
      expect(res.status, `request ${i}`).toBe(201);
      ids.push(res.body.id);
    }

    const sixth = await request(playerToken, { type: 'INCREASE', amount: 10, reason: 'r5' });
    expect(sixth.status).toBe(409);
    expect(sixth.body.code).toBe('TOO_MANY_PENDING');

    await api().post(`/api/v1/admin/wallet-requests/${ids[0]}/approve`).set(adminSession);
    const seventh = await request(playerToken, { type: 'INCREASE', amount: 10, reason: 'r6' });
    expect(seventh.status).toBe(201);
  });

  it('20 concurrent requests from one player: at most 5 succeed', async () => {
    const { playerToken } = await playerWithAdmin();

    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) => request(playerToken, { type: 'INCREASE', amount: 1, reason: `c${i}` })),
    );

    expect(results.filter((r) => r.status === 201)).toHaveLength(5);
    expect(results.filter((r) => r.status === 409)).toHaveLength(15);
  });
});

describe('FR-06 — filing a request notifies the client\'s active Client Admins only', () => {
  it('not a blocked admin, not another client\'s admin', async () => {
    const { client, admin, playerToken } = await playerWithAdmin();
    const blockedAdmin = await createUser({ role: 'CLIENT_ADMIN', clientId: client.id, isActive: 0 });
    const otherClient = await createClient();
    const foreignAdmin = await createUser({ role: 'CLIENT_ADMIN', clientId: otherClient.id });

    await request(playerToken, { type: 'INCREASE', amount: 50, reason: 'notify me' });

    expect(await prisma.notification.count({ where: { userId: admin.id, Lookup: { code: 'WALLET_REQUEST_RECEIVED' } } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: blockedAdmin.id } })).toBe(0);
    expect(await prisma.notification.count({ where: { userId: foreignAdmin.id } })).toBe(0);
  });
});

describe('FR-10 — concurrent approvals of one request: exactly one wins', () => {
  it('10 parallel approves credit the wallet exactly once', async () => {
    const { wallet, adminSession, playerToken } = await playerWithAdmin(1000);
    const created = await request(playerToken, { type: 'INCREASE', amount: 5000, reason: 'race' });

    const results = await Promise.all(
      Array.from({ length: 10 }, () => api().post(`/api/v1/admin/wallet-requests/${created.body.id}/approve`).set(adminSession)),
    );

    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(9);
    const row = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    expect(row.availableBalance.toNumber()).toBe(6000);
  });
});

describe('FR-12 / FR-13 — a DECREASE never pushes the wallet negative', () => {
  it('insufficient funds → 409, wallet unchanged, request stays PENDING for a retry', async () => {
    const { wallet, adminSession, playerToken } = await playerWithAdmin(100);
    const created = await request(playerToken, { type: 'DECREASE', amount: 500, reason: 'withdraw' });

    const res = await api().post(`/api/v1/admin/wallet-requests/${created.body.id}/approve`).set(adminSession);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INSUFFICIENT_FUNDS');
    expect((await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).availableBalance.toNumber()).toBe(100);
    const stillPending = await api().get('/api/v1/wallet/requests').set(playerToken);
    expect(stillPending.body[0].status).toBe('PENDING');
  });

  it('20 parallel DECREASE approvals against funds for exactly 2: balance never negative', async () => {
    const { wallet, adminSession, playerToken } = await playerWithAdmin(200);
    const ids: number[] = [];
    for (let i = 0; i < 20; i += 1) {
      ids.push((await request(playerToken, { type: 'DECREASE', amount: 100, reason: `d${i}` })).body.id);
    }

    const results = await Promise.all(ids.map((id) => api().post(`/api/v1/admin/wallet-requests/${id}/approve`).set(adminSession)));

    expect(results.filter((r) => r.status === 200)).toHaveLength(2);
    const row = await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } });
    expect(row.availableBalance.toNumber()).toBe(0);
  });
});

describe('FR-14 — approving for a player who is no longer active', () => {
  it('409 USER_NOT_ACTIVE; the request stays PENDING (rolled back)', async () => {
    const { player, wallet, adminSession, playerToken } = await playerWithAdmin(100);
    const created = await request(playerToken, { type: 'INCREASE', amount: 50, reason: 'x' });
    await prisma.user.update({ where: { id: player.id }, data: { isActive: 0 } });

    const res = await api().post(`/api/v1/admin/wallet-requests/${created.body.id}/approve`).set(adminSession);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USER_NOT_ACTIVE');
    expect((await prisma.wallet.findUniqueOrThrow({ where: { id: wallet.id } })).availableBalance.toNumber()).toBe(100);
  });
});

describe('FR-16 / FR-17 — who may resolve which requests', () => {
  it('another client\'s admin gets 404 (never a 403 that would confirm it exists)', async () => {
    const { playerToken } = await playerWithAdmin();
    const created = await request(playerToken, { type: 'INCREASE', amount: 10, reason: 'x' });
    const foreignClient = await createClient();
    const foreignAdmin = await createUser({ role: 'CLIENT_ADMIN', clientId: foreignClient.id });

    const res = await api().post(`/api/v1/admin/wallet-requests/${created.body.id}/approve`).set(sessionFor(foreignAdmin.id, 'admin'));
    expect(res.status).toBe(404);
  });

  it('a player can never resolve, even their own', async () => {
    const { playerToken } = await playerWithAdmin();
    const created = await request(playerToken, { type: 'INCREASE', amount: 10, reason: 'x' });

    expect((await api().post(`/api/v1/admin/wallet-requests/${created.body.id}/approve`).set(playerToken)).status).toBe(401);
  });

  it('the SuperAdmin resolves any client\'s request', async () => {
    const { playerToken } = await playerWithAdmin();
    const created = await request(playerToken, { type: 'INCREASE', amount: 10, reason: 'x' });
    const sa = sessionFor((await createUser({ role: 'SUPER_ADMIN' })).id, 'admin');

    const res = await api().post(`/api/v1/admin/wallet-requests/${created.body.id}/approve`).set(sa);
    expect(res.status).toBe(200);
    expect(res.body.resolvedBy).toBeTruthy();
  });
});

describe('FR — validation', () => {
  it.each([
    ['negative amount', { type: 'INCREASE', amount: -5, reason: 'x' }],
    ['more than 2 decimals', { type: 'INCREASE', amount: 10.999, reason: 'x' }],
    ['empty reason', { type: 'INCREASE', amount: 10, reason: '' }],
    ['unknown field', { type: 'INCREASE', amount: 10, reason: 'x', clientId: 1 }],
  ])('%s → 400', async (_label, body) => {
    const { playerToken } = await playerWithAdmin();
    const res = await request(playerToken, body);
    expect(res.status).toBe(400);
  });
});

describe('reject leaves the door open only for a fresh request', () => {
  it('a rejected user can immediately file a new one (does not count toward the pending cap)', async () => {
    const { adminSession, playerToken } = await playerWithAdmin();
    const created = await request(playerToken, { type: 'INCREASE', amount: 10, reason: 'x' });
    await api().post(`/api/v1/admin/wallet-requests/${created.body.id}/reject`).set(adminSession);

    const again = await request(playerToken, { type: 'INCREASE', amount: 10, reason: 'y' });
    expect(again.status).toBe(201);
  });
});
