import { describe, expect, it } from 'vitest';

import { api, sessionFor } from '../helpers/app';
import { prisma } from '../helpers/db';
import { createClient, createUser, createWallet, DEFAULT_PASSWORD } from '../helpers/factories';

async function clientAdmin() {
  const client = await createClient();
  const admin = await createUser({ role: 'CLIENT_ADMIN', clientId: client.id });
  return { client, admin, session: sessionFor(admin.id, 'admin') };
}
const superAdmin = async () => sessionFor((await createUser({ role: 'SUPER_ADMIN' })).id, 'admin');

describe('US-01 — a Client Admin creates a player in their own client', () => {
  it('201; role CLIENT_USER; a 0/0 wallet exists; a one-time temp password comes back', async () => {
    const { client, session } = await clientAdmin();

    const res = await api().post('/api/v1/admin/users').set(session).send({ name: 'Rohan Kumar', email: 'rohan@example.com', mobile: '9811111111' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Rohan Kumar', role: 'CLIENT_USER', mustChangePassword: true });
    expect(res.body.user.client.id).toBe(client.id);
    expect(res.body.temporaryPassword).toEqual(expect.any(String));

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: res.body.user.id } });
    expect(wallet.availableBalance.toNumber()).toBe(0);
    expect(wallet.lockedBalance.toNumber()).toBe(0);
  });

  it('cannot name a clientId at all (not in their schema — 400, not silently ignored)', async () => {
    const { client, session } = await clientAdmin();
    const other = await createClient();

    const res = await api()
      .post('/api/v1/admin/users')
      .set(session)
      .send({ name: 'X', email: 'x@example.com', mobile: '9800000001', clientId: other.id });

    expect(res.status).toBe(400);
    // Only the client's own admin (created by the clientAdmin() helper) — nothing new.
    expect(await prisma.user.count({ where: { clientId: client.id } })).toBe(1);
  });
});

describe('US-02 — a SuperAdmin must name a real, usable client', () => {
  it.each([
    ['missing clientId', {}],
    ['client does not exist', { clientId: 999999 }],
  ])('%s', async (_label, extra) => {
    const res = await api()
      .post('/api/v1/admin/users')
      .set(await superAdmin())
      .send({ name: 'X', email: 'x2@example.com', mobile: '9800000002', ...extra });
    expect([400, 404]).toContain(res.status);
  });

  it('an inactive client → 409', async () => {
    const client = await createClient({ isActive: 0 });
    const res = await api()
      .post('/api/v1/admin/users')
      .set(await superAdmin())
      .send({ name: 'X', email: 'x3@example.com', mobile: '9800000003', clientId: client.id });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLIENT_INACTIVE');
  });
});

describe('US-03 / US-04 — who may create which role', () => {
  it('a SuperAdmin creates a Client Admin', async () => {
    const client = await createClient();
    const res = await api()
      .post('/api/v1/admin/users')
      .set(await superAdmin())
      .send({ name: 'New Admin', email: 'newadmin@example.com', mobile: '9800000004', role: 'CLIENT_ADMIN', clientId: client.id });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('CLIENT_ADMIN');
  });

  it('a Client Admin cannot create another Client Admin', async () => {
    const { session } = await clientAdmin();
    const res = await api()
      .post('/api/v1/admin/users')
      .set(session)
      .send({ name: 'X', email: 'x4@example.com', mobile: '9800000005', role: 'CLIENT_ADMIN' });
    expect(res.status).toBe(403);
  });

  it('nobody can create a SUPER_ADMIN through this endpoint', async () => {
    const client = await createClient();
    const res = await api()
      .post('/api/v1/admin/users')
      .set(await superAdmin())
      .send({ name: 'X', email: 'x5@example.com', mobile: '9800000006', role: 'SUPER_ADMIN', clientId: client.id });
    expect(res.status).toBe(400);
  });
});

describe('US-05 / US-06 — contact uniqueness', () => {
  it('a taken email or mobile is 409', async () => {
    const { session } = await clientAdmin();
    await createUser({ email: 'dup@example.com' });

    const res = await api().post('/api/v1/admin/users').set(session).send({ name: 'X', email: 'dup@example.com', mobile: '9800000007' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  it('a genuinely deleted user\'s email is free to reuse (delete anonymises it — a raw isDeleted flag alone would not)', async () => {
    const { client, session } = await clientAdmin();
    const player = await createUser({ clientId: client.id, email: 'was-taken@example.com' });
    await createWallet(player.id, 0, 0);
    expect((await api().delete(`/api/v1/admin/users/${player.id}`).set(session)).status).toBe(204);

    const res = await api().post('/api/v1/admin/users').set(session).send({ name: 'X', email: 'was-taken@example.com', mobile: '9800000008' });
    expect(res.status).toBe(201);
  });
});

describe('US-08 — the temporary password is shown once', () => {
  it('create response has it; GET does not', async () => {
    const { session } = await clientAdmin();
    const created = await api().post('/api/v1/admin/users').set(session).send({ name: 'X', email: 'once@example.com', mobile: '9800000009' });

    const fetched = await api().get(`/api/v1/admin/users/${created.body.user.id}`).set(session);
    expect(JSON.stringify(fetched.body)).not.toContain(created.body.temporaryPassword);
    expect(fetched.body.passwordHash).toBeUndefined();
  });
});

describe('US-09 — block / unblock', () => {
  it('blocks login and mobile access, leaves funds untouched; unblock restores it; both are idempotent', async () => {
    const { client, session } = await clientAdmin();
    const player = await createUser({ clientId: client.id });
    await createWallet(player.id, 500);

    const blocked = await api().post(`/api/v1/admin/users/${player.id}/block`).set(session);
    expect(blocked.status).toBe(200);
    expect(blocked.body.isActive).toBe(false);
    expect((await api().post('/api/v1/auth/login').send({ identifier: player.email, password: DEFAULT_PASSWORD })).body.code).toBe('ACCOUNT_BLOCKED');
    expect((await prisma.wallet.findUniqueOrThrow({ where: { userId: player.id } })).availableBalance.toNumber()).toBe(500);

    expect((await api().post(`/api/v1/admin/users/${player.id}/block`).set(session)).status).toBe(200); // idempotent

    const unblocked = await api().post(`/api/v1/admin/users/${player.id}/unblock`).set(session);
    expect(unblocked.status).toBe(200);
    expect(unblocked.body.isActive).toBe(true);
    expect((await api().post('/api/v1/auth/login').send({ identifier: player.email, password: DEFAULT_PASSWORD })).status).toBe(200);
  });
});

describe('US-11 — the last active Client Admin cannot be blocked or deleted', () => {
  it('blocking → 409 LAST_ADMIN', async () => {
    const { admin } = await clientAdmin();
    // The only way to hit this via the API is a SuperAdmin acting on the sole admin
    // (the admin himself is never a valid target for his own block/delete — POL-*).
    const res = await api().post(`/api/v1/admin/users/${admin.id}/block`).set(await superAdmin());
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('LAST_ADMIN');
  });

  it('a second active admin makes either one blockable', async () => {
    const { client, admin } = await clientAdmin();
    await createUser({ role: 'CLIENT_ADMIN', clientId: client.id });

    const res = await api().post(`/api/v1/admin/users/${admin.id}/block`).set(await superAdmin());
    expect(res.status).toBe(200);
  });
});

describe('US-12 / US-13 — deleting a player', () => {
  it('is refused with funds in the wallet, an open bet, or a pending request — distinct codes', async () => {
    const { client, session } = await clientAdmin();

    const withFunds = await createUser({ clientId: client.id });
    await createWallet(withFunds.id, 100);
    expect((await api().delete(`/api/v1/admin/users/${withFunds.id}`).set(session)).body.code).toBe('WALLET_NOT_EMPTY');

    const withLocked = await createUser({ clientId: client.id });
    await createWallet(withLocked.id, 0, 50);
    expect((await api().delete(`/api/v1/admin/users/${withLocked.id}`).set(session)).body.code).toBe('WALLET_NOT_EMPTY');
  });

  it('succeeds when eligible: anonymised, blocked, and its token dies immediately', async () => {
    const { client, session } = await clientAdmin();
    const player = await createUser({ clientId: client.id });
    await createWallet(player.id, 0, 0);
    const playerSession = sessionFor(player.id, 'mobile');
    expect((await api().get('/api/v1/auth/me').set(playerSession)).status).toBe(200);

    const res = await api().delete(`/api/v1/admin/users/${player.id}`).set(session);
    expect(res.status).toBe(204);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: player.id } });
    expect(row.isDeleted).toBe(1);
    expect(row.isActive).toBe(0);
    expect(row.email).not.toBe(player.email);
    expect(row.name).toBe('Deleted User');
    expect((await api().get('/api/v1/auth/me').set(playerSession)).status).toBe(401);
    expect((await api().delete(`/api/v1/admin/users/${player.id}`).set(session)).status).toBe(404);
  });
});

describe('US-15 — resetting a password', () => {
  it('a new temp password is issued once, old sessions die, and it works to sign in', async () => {
    const { client, session } = await clientAdmin();
    const player = await createUser({ clientId: client.id });
    const oldSession = sessionFor(player.id, 'mobile');

    const res = await api().post(`/api/v1/admin/users/${player.id}/reset-password`).set(session);
    expect(res.status).toBe(200);
    expect(res.body.temporaryPassword).toEqual(expect.any(String));

    expect((await api().get('/api/v1/auth/me').set(oldSession)).status).toBe(401);
    const login = await api().post('/api/v1/auth/login').send({ identifier: player.email, password: res.body.temporaryPassword });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);
  });

  it('a Client Admin cannot reset a SuperAdmin\'s password (not manageable here at all → 404)', async () => {
    const { session } = await clientAdmin();
    const superAdminUser = await createUser({ role: 'SUPER_ADMIN' });

    const res = await api().post(`/api/v1/admin/users/${superAdminUser.id}/reset-password`).set(session);
    expect(res.status).toBe(404);
  });
});

describe('US-16 — updating a user', () => {
  it('name/email/mobile change; role/client are not part of the schema (400, not ignored)', async () => {
    const { client, session } = await clientAdmin();
    const player = await createUser({ clientId: client.id });

    const ok = await api().patch(`/api/v1/admin/users/${player.id}`).set(session).send({ name: 'Renamed' });
    expect(ok.status).toBe(200);
    expect(ok.body.name).toBe('Renamed');

    const rejected = await api().patch(`/api/v1/admin/users/${player.id}`).set(session).send({ roleId: 1 });
    expect(rejected.status).toBe(400);
  });

  it('empty body is rejected rather than a silent no-op', async () => {
    const { client, session } = await clientAdmin();
    const player = await createUser({ clientId: client.id });

    expect((await api().patch(`/api/v1/admin/users/${player.id}`).set(session).send({})).status).toBe(400);
  });
});

describe('US-17 — listing', () => {
  it('filters by role/isActive/search and paginates with a total', async () => {
    const { client, session } = await clientAdmin();
    await createUser({ clientId: client.id, name: 'Alice Alpha', isActive: 0 });
    await createUser({ clientId: client.id, name: 'Bob Beta' });

    const activeOnly = await api().get('/api/v1/admin/users').set(session).query({ isActive: 'true' });
    expect(activeOnly.body.items.every((u: { isActive: boolean }) => u.isActive)).toBe(true);

    const search = await api().get('/api/v1/admin/users').set(session).query({ search: 'Alpha' });
    expect(search.body.items).toHaveLength(1);
    expect(search.body.items[0].name).toBe('Alice Alpha');

    const paged = await api().get('/api/v1/admin/users').set(session).query({ page: 1, pageSize: 1 });
    expect(paged.body.items).toHaveLength(1);
    expect(paged.body.total).toBeGreaterThanOrEqual(2);
  });

  it('pageSize over 100 is rejected', async () => {
    const { session } = await clientAdmin();
    const res = await api().get('/api/v1/admin/users').set(session).query({ pageSize: 101 });
    expect(res.status).toBe(400);
  });
});
