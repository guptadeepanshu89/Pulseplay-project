import { describe, expect, it } from 'vitest';

import { LOOKUP_IDS } from '../../src/lib/lookupCache';
import { api, sessionFor } from '../helpers/app';
import { prisma } from '../helpers/db';
import { createClient, createUser, createWallet } from '../helpers/factories';

const superAdmin = async () => sessionFor((await createUser({ role: 'SUPER_ADMIN' })).id, 'admin');

const create = (session: Record<string, string>, body: Record<string, unknown>) =>
  api().post('/api/v1/admin/clients').set(session).send(body);

const validBody = (overrides: Record<string, unknown> = {}) => ({
  code: 'NITIN',
  name: 'Nitin Enterprises',
  admin: { name: 'Nitin Admin', email: 'nitin.admin@example.com', mobile: '9812345670' },
  ...overrides,
});

describe('CL-01 — SuperAdmin creates a Client + its first Client Admin', () => {
  it('one transaction: 201, admin has mustChangePassword=1, a one-time temp password comes back', async () => {
    const sa = await superAdmin();

    const res = await create(sa, validBody());

    expect(res.status).toBe(201);
    expect(res.body.client).toMatchObject({ code: 'NITIN', name: 'Nitin Enterprises', isActive: true });
    expect(res.body.admin).toMatchObject({ email: 'nitin.admin@example.com' });
    expect(res.body.admin.temporaryPassword).toEqual(expect.any(String));

    const admin = await prisma.user.findUniqueOrThrow({ where: { email: 'nitin.admin@example.com' }, include: { Role: true } });
    expect(admin.Role.code).toBe('CLIENT_ADMIN');
    expect(admin.clientId).toBe(res.body.client.id);
    expect(admin.mustChangePassword).toBe(1);
    expect(admin.createdByUserId).not.toBeNull();
  });
});

describe('CL-02 — a duplicate admin email/mobile rolls back the whole thing', () => {
  it('no Client row is left behind', async () => {
    const sa = await superAdmin();
    await createUser({ email: 'taken@example.com' });

    const res = await create(sa, validBody({ admin: { name: 'X', email: 'taken@example.com', mobile: '9800000000' } }));

    expect(res.status).toBe(409);
    expect(await prisma.client.findUnique({ where: { code: 'NITIN' } })).toBeNull();
  });
});

describe('CL-03 — a duplicate client code is rejected', () => {
  it('case-insensitive (the code is upper-cased)', async () => {
    const sa = await superAdmin();
    await createClient({ code: 'NITIN' });

    const res = await create(sa, validBody({ code: 'nitin' }));

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CODE_TAKEN');
  });
});

describe('CL-04 — validation', () => {
  it.each([
    ['missing code', validBody({ code: undefined })],
    ['bad code shape', validBody({ code: 'a b!' })],
    ['missing admin', { code: 'X1', name: 'X' }],
    ['unknown field', validBody({ isActive: 1 })],
  ])('%s → 400', async (_label, body) => {
    const res = await create(await superAdmin(), body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('CL-05 — only a SuperAdmin creates a Client', () => {
  it('a Client Admin (admin panel, wrong role) → 403', async () => {
    const client = await createClient();
    const user = await createUser({ role: 'CLIENT_ADMIN', clientId: client.id });

    const res = await create(sessionFor(user.id, 'admin'), validBody());
    expect(res.status).toBe(403);
  });

  it('a Client User (mobile-only token, this route never accepts it) → 401', async () => {
    const client = await createClient();
    const user = await createUser({ role: 'CLIENT_USER', clientId: client.id });

    const res = await create(sessionFor(user.id, 'mobile'), validBody());
    expect(res.status).toBe(401);
  });
});

describe('CL-07 — updating a client', () => {
  it('name changes; code is not part of the schema at all (400, not silently ignored)', async () => {
    const sa = await superAdmin();
    const client = await createClient({ code: 'ABC' });

    const renamed = await api().patch(`/api/v1/admin/clients/${client.id}`).set(sa).send({ name: 'New Name' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('New Name');

    const attempted = await api().patch(`/api/v1/admin/clients/${client.id}`).set(sa).send({ name: 'X', code: 'ZZZ' });
    expect(attempted.status).toBe(400);
    expect((await prisma.client.findUniqueOrThrow({ where: { id: client.id } })).code).toBe('ABC');
  });
});

describe('CL-08 / CL-09 — deactivate / reactivate', () => {
  it('cuts off login for its users and restores it', async () => {
    const sa = await superAdmin();
    const client = await createClient();
    const player = await createUser({ clientId: client.id });

    const off = await api().post(`/api/v1/admin/clients/${client.id}/deactivate`).set(sa).send({});
    expect(off.status).toBe(200);
    expect(off.body.isActive).toBe(false);
    const blocked = await api().get('/api/v1/auth/me').set(sessionFor(player.id, 'mobile'));
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('CLIENT_INACTIVE');

    const on = await api().post(`/api/v1/admin/clients/${client.id}/reactivate`).set(sa).send({});
    expect(on.status).toBe(200);
    expect(on.body.isActive).toBe(true);
    expect((await api().get('/api/v1/auth/me').set(sessionFor(player.id, 'mobile'))).status).toBe(200);
  });
});

describe('CL-10 / CL-11 / CL-12 — deleting a client', () => {
  it('is refused while it still has an active player or a pending request', async () => {
    const sa = await superAdmin();
    const client = await createClient();
    await createUser({ clientId: client.id });

    const res = await api().delete(`/api/v1/admin/clients/${client.id}`).set(sa);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLIENT_HAS_ACTIVE_USERS');
  });

  it('succeeds once the client has no active players and no pending requests — admins are anonymised, code freed, twice is 404', async () => {
    const sa = await superAdmin();
    const client = await createClient({ code: 'GONE' });
    const admin = await createUser({ role: 'CLIENT_ADMIN', clientId: client.id });

    const res = await api().delete(`/api/v1/admin/clients/${client.id}`).set(sa);
    expect(res.status).toBe(204);

    const row = await prisma.client.findUniqueOrThrow({ where: { id: client.id } });
    expect(row.isDeleted).toBe(1);
    expect(row.code).not.toBe('GONE');
    const adminRow = await prisma.user.findUniqueOrThrow({ where: { id: admin.id } });
    expect(adminRow.isDeleted).toBe(1);
    expect(adminRow.email).not.toBe(admin.email);

    expect((await api().delete(`/api/v1/admin/clients/${client.id}`).set(sa)).status).toBe(404);
    // The freed code can be reused straight away.
    expect((await create(sa, validBody({ code: 'GONE' }))).status).toBe(201);
  });

  it('a pending request also blocks deletion, even with zero active players', async () => {
    const sa = await superAdmin();
    const client = await createClient();
    const player = await createUser({ clientId: client.id });
    const wallet = await createWallet(player.id);
    await prisma.walletRequest.create({
      data: {
        walletId: wallet.id,
        userId: player.id,
        clientId: client.id,
        typeId: LOOKUP_IDS.WALLET_REQUEST_TYPE.INCREASE,
        amount: 10,
        reason: 'x',
        statusId: LOOKUP_IDS.WALLET_REQUEST_STATUS.PENDING,
      },
    });
    await prisma.user.update({ where: { id: player.id }, data: { isDeleted: 1 } }); // remove the "active player" blocker so only the request remains

    const res = await api().delete(`/api/v1/admin/clients/${client.id}`).set(sa);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('CLIENT_HAS_PENDING_REQUESTS');
  });
});
