import { describe, expect, it } from 'vitest';

import { api, sessionFor } from '../helpers/app';
import { createClient, createUser, createUserWithWallet } from '../helpers/factories';

// TN — tenant isolation. A Client Admin must never be able to tell a foreign
// client's object from one that does not exist at all.

async function twoClients() {
  const a = await createClient();
  const b = await createClient();
  const aAdmin = await createUser({ role: 'CLIENT_ADMIN', clientId: a.id });
  const bUser = await createUser({ clientId: b.id });
  return { a, b, aAdminSession: sessionFor(aAdmin.id, 'admin'), bUser };
}

describe('TN-02 — a foreign user is 404 on every single-user route', () => {
  it('GET / PATCH / block / reset-password / delete', async () => {
    const { aAdminSession, bUser } = await twoClients();
    const url = `/api/v1/admin/users/${bUser.id}`;

    expect((await api().get(url).set(aAdminSession)).status).toBe(404);
    expect((await api().patch(url).set(aAdminSession).send({ name: 'Hacked' })).status).toBe(404);
    expect((await api().post(`${url}/block`).set(aAdminSession)).status).toBe(404);
    expect((await api().post(`${url}/reset-password`).set(aAdminSession)).status).toBe(404);
    expect((await api().delete(url).set(aAdminSession)).status).toBe(404);
  });

  it('is byte-identical to a non-existent id', async () => {
    const { aAdminSession, bUser } = await twoClients();

    const foreign = await api().get(`/api/v1/admin/users/${bUser.id}`).set(aAdminSession);
    const missing = await api().get('/api/v1/admin/users/999999').set(aAdminSession);

    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual(missing.body);
  });
});

describe('TN-03 — a foreign fund request is 404, never touched', () => {
  it('approve and reject both refuse it, balance stays put', async () => {
    const { aAdminSession } = await twoClients();
    const otherClient = await createClient();
    const { user: foreignPlayer } = await createUserWithWallet(1000, 0, { clientId: otherClient.id });
    const created = await api()
      .post('/api/v1/wallet/requests')
      .set(sessionFor(foreignPlayer.id, 'mobile'))
      .send({ type: 'INCREASE', amount: 500, reason: 'x' });

    expect((await api().post(`/api/v1/admin/wallet-requests/${created.body.id}/approve`).set(aAdminSession)).status).toBe(404);
    expect((await api().post(`/api/v1/admin/wallet-requests/${created.body.id}/reject`).set(aAdminSession)).status).toBe(404);
  });
});

describe('TN-05 — searching cannot confirm a foreign user exists', () => {
  it('a search for a foreign user\'s exact name/email returns nothing', async () => {
    const { aAdminSession, bUser } = await twoClients();

    const byName = await api().get('/api/v1/admin/users').set(aAdminSession).query({ search: bUser.name });
    const byEmail = await api().get('/api/v1/admin/users').set(aAdminSession).query({ search: bUser.email });

    expect(byName.body.items).toEqual([]);
    expect(byEmail.body.items).toEqual([]);
  });
});

describe('TN-06 — pagination totals only count in-scope rows', () => {
  it('a Client Admin\'s total never includes another client\'s users', async () => {
    const { a, aAdminSession } = await twoClients();
    await createUser({ clientId: a.id });
    await createUser({ clientId: a.id });
    const otherClient = await createClient();
    await createUser({ clientId: otherClient.id });
    await createUser({ clientId: otherClient.id });
    await createUser({ clientId: otherClient.id });

    const res = await api().get('/api/v1/admin/users').set(aAdminSession);
    // The 2 new players plus client A's own admin (created by twoClients()) — never B's.
    expect(res.body.total).toBe(3);
  });
});

describe('TN-09 — a SuperAdmin sees everything, and can filter by client', () => {
  it('an unfiltered list spans both clients; a filtered one matches exactly one', async () => {
    const { a, b } = await twoClients();
    const sa = sessionFor((await createUser({ role: 'SUPER_ADMIN' })).id, 'admin');

    const all = await api().get('/api/v1/admin/users').set(sa);
    expect(all.body.total).toBeGreaterThanOrEqual(2);

    const onlyA = await api().get('/api/v1/admin/users').set(sa).query({ clientId: a.id });
    expect(onlyA.body.items.every((u: { client: { id: number } }) => u.client.id === a.id)).toBe(true);
    expect(onlyA.body.total).toBe(1); // the Client Admin created in twoClients()

    const onlyB = await api().get('/api/v1/admin/users').set(sa).query({ clientId: b.id });
    expect(onlyB.body.items.every((u: { client: { id: number } }) => u.client.id === b.id)).toBe(true);
  });
});

describe('TN-10 — admin bet/dashboard reporting never crosses tenants', () => {
  it('a Client Admin\'s /admin/bets and /admin/dashboard only ever reflect their own client', async () => {
    const { aAdminSession } = await twoClients();

    const bets = await api().get('/api/v1/admin/bets').set(aAdminSession);
    expect(bets.body).toEqual([]);

    const dashboard = await api().get('/api/v1/admin/dashboard').set(aAdminSession);
    expect(dashboard.body.activeClients).toBeUndefined();
  });
});
