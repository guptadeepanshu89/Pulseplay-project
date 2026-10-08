import { describe, expect, it } from 'vitest';

import { COOKIE_NAME } from '../../src/core/tokens';
import { RoleCode } from '../../src/lib/roleCache';
import { api, bearer, forgeToken, sessionFor, tokenFor, withCookie } from '../helpers/app';
import { createClient, createUser, DEFAULT_PASSWORD } from '../helpers/factories';
import { prisma } from '../helpers/db';
import { TEST_ENV } from '../testEnv';

const me = (headers: Record<string, string>) => api().get('/api/v1/auth/me').set(headers);
const base64url = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

// Player → mobile app, staff → admin panel.
const appOf = (role: RoleCode) => (role === 'CLIENT_USER' ? 'mobile' : 'admin');
const ROLES: RoleCode[] = ['CLIENT_USER', 'CLIENT_ADMIN', 'SUPER_ADMIN'];

describe('AUTH-10 — a password change invalidates every older token', () => {
  it('other sessions die at once; the session that changed it carries on with a fresh token', async () => {
    const user = await createUser();
    const login = () => api().post('/api/v1/auth/login').send({ identifier: user.email, password: DEFAULT_PASSWORD });
    const sessionA = (await login()).body.token as string;
    const sessionB = (await login()).body.token as string;

    const changed = await api()
      .post('/api/v1/auth/change-password')
      .set(bearer(sessionA))
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'a-brand-new-pass-9' });

    // Same second as the login on purpose: a JWT `iat` (whole seconds) could not
    // tell these apart — the credential-version claim can.
    const stale = await me(bearer(sessionB));
    expect(stale.status).toBe(401);
    expect(stale.body.code).toBe('TOKEN_REVOKED');
    expect((await me(bearer(sessionA))).status).toBe(401);
    expect((await me(bearer(changed.body.token))).status).toBe(200);
  });

  it('a reset done directly in the database (e.g. by an admin) revokes existing tokens too', async () => {
    const user = await createUser();
    const before = bearer(tokenFor(user.id, 'mobile'));
    expect((await me(before)).status).toBe(200);

    await prisma.user.update({ where: { id: user.id }, data: { passwordChangedAt: new Date() } });

    const res = await me(before);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_REVOKED');
  });

  it('a token whose credential version does not match (forged or from another era) is revoked', async () => {
    const user = await createUser();
    await prisma.user.update({ where: { id: user.id }, data: { passwordChangedAt: new Date('2026-01-01T00:00:00Z') } });

    const current = tokenFor(user.id, 'mobile', new Date('2026-01-01T00:00:00Z').getTime());
    const wrong = tokenFor(user.id, 'mobile', 123);

    expect((await me(bearer(current))).status).toBe(200);
    expect((await me(bearer(wrong))).body.code).toBe('TOKEN_REVOKED');
  });
});

describe('AUTH-11 — tokens the verifier must refuse', () => {
  const claimsOf = (userId: number, extra: Record<string, unknown> = {}) => ({ sub: String(userId), app: 'mobile', pv: 0, ...extra });

  async function cases() {
    const user = await createUser();
    const good = tokenFor(user.id, 'mobile');
    const [header, payload, signature] = good.split('.');
    const otherUser = await createUser();
    const otherPayload = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(payload, 'base64url').toString()), sub: String(otherUser.id) })).toString('base64url');

    const table: [string, string][] = [
      ['expired', forgeToken(claimsOf(user.id), { expiresIn: -10 })],
      ['signed with the wrong secret', forgeToken(claimsOf(user.id), {}, 'a-completely-different-secret-value-xxxxxxxx')],
      ['payload swapped, original signature kept', `${header}.${otherPayload}.${signature}`],
      ['alg=none (unsigned)', `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(claimsOf(user.id))}.`],
      ['alg=none with a junk signature', `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url(claimsOf(user.id))}.AAAA`],
      ['HS512 with the right secret (only HS256 is accepted)', forgeToken(claimsOf(user.id), { algorithm: 'HS512' })],
      ['no `sub`', forgeToken({ app: 'mobile', pv: 0 })],
      ['non-numeric `sub`', forgeToken(claimsOf(user.id, { sub: 'abc' }))],
      ['fractional `sub`', forgeToken(claimsOf(user.id, { sub: '1.5' }))],
      ['no `app`', forgeToken({ sub: String(user.id), pv: 0 })],
      ['unknown `app`', forgeToken(claimsOf(user.id, { app: 'superadmin' }))],
      ['no `pv`', forgeToken({ sub: String(user.id), app: 'mobile' })],
      ['non-numeric `pv`', forgeToken(claimsOf(user.id, { pv: '0' }))],
      ['a user id that does not exist', forgeToken(claimsOf(987654))],
      ['garbage', 'not-a-jwt'],
      ['empty', ''],
    ];
    return table;
  }

  it('every malformed / forged / expired Bearer token → 401 UNAUTHENTICATED', async () => {
    for (const [label, token] of await cases()) {
      const res = await me(bearer(token));
      expect(res.status, label).toBe(401);
      expect(res.body.code, label).toBe('UNAUTHENTICATED');
    }
  });

  it('…and the same tokens in the cookie', async () => {
    for (const [label, token] of await cases()) {
      const res = await me(withCookie(`${COOKIE_NAME.mobile}=${token}`));
      expect(res.status, label).toBe(401);
    }
  });

  it('a non-Bearer Authorization scheme is ignored', async () => {
    const user = await createUser();

    const res = await me({ Authorization: `Basic ${tokenFor(user.id, 'mobile')}` });

    expect(res.status).toBe(401);
  });

  it('an invalid Bearer header is not rescued by a valid cookie (the header is authoritative)', async () => {
    const user = await createUser();

    const res = await me({ Authorization: 'Bearer garbage', Cookie: `${COOKIE_NAME.mobile}=${tokenFor(user.id, 'mobile')}` });

    expect(res.status).toBe(401);
  });

  it('control: the same user with a genuine token is fine', async () => {
    const user = await createUser();
    expect((await me(bearer(tokenFor(user.id, 'mobile')))).status).toBe(200);
    expect(TEST_ENV.JWT_SECRET.length).toBeGreaterThan(20);
  });
});

describe('AUTH-12 — deleting a user bites immediately, not when the token expires', () => {
  it.each(ROLES)('%s', async (role) => {
    const user = await createUser({ role });
    const headers = sessionFor(user.id, appOf(role));
    expect((await me(headers)).status).toBe(200);

    await prisma.user.update({ where: { id: user.id }, data: { isDeleted: 1 } });

    const res = await me(headers);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHENTICATED');
  });

  it('deleting the whole client kills its members\' sessions too', async () => {
    const client = await createClient();
    const member = await createUser({ clientId: client.id });
    const headers = sessionFor(member.id, 'mobile');
    expect((await me(headers)).status).toBe(200);

    await prisma.client.update({ where: { id: client.id }, data: { isDeleted: 1 } });

    expect((await me(headers)).status).toBe(401);
  });
});

describe('AUTH-13 — blocking is immediate and reversible', () => {
  it.each(ROLES)('%s', async (role) => {
    const user = await createUser({ role });
    const headers = sessionFor(user.id, appOf(role));

    await prisma.user.update({ where: { id: user.id }, data: { isActive: 0 } });
    const blocked = await me(headers);
    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('ACCOUNT_BLOCKED');

    await prisma.user.update({ where: { id: user.id }, data: { isActive: 1 } });
    expect((await me(headers)).status).toBe(200);
  });
});

describe('AUTH-14 — deactivating a client suspends all of its accounts, and only them', () => {
  it('rejects its players and admins, spares other clients and the SuperAdmin, then restores on reactivation', async () => {
    const client = await createClient();
    const otherClient = await createClient();
    const player = await createUser({ clientId: client.id });
    const clientAdmin = await createUser({ role: 'CLIENT_ADMIN', clientId: client.id });
    const outsider = await createUser({ clientId: otherClient.id });
    const superAdmin = await createUser({ role: 'SUPER_ADMIN' });

    const playerSession = sessionFor(player.id, 'mobile');
    const adminSession = sessionFor(clientAdmin.id, 'admin');
    const outsiderSession = sessionFor(outsider.id, 'mobile');
    const superSession = sessionFor(superAdmin.id, 'admin');

    await prisma.client.update({ where: { id: client.id }, data: { isActive: 0 } });

    for (const session of [playerSession, adminSession]) {
      const res = await me(session);
      expect(res.status).toBe(403);
      expect(res.body.code).toBe('CLIENT_INACTIVE');
    }
    expect((await me(outsiderSession)).status).toBe(200);
    expect((await me(superSession)).status).toBe(200);

    await prisma.client.update({ where: { id: client.id }, data: { isActive: 1 } });

    expect((await me(playerSession)).status).toBe(200);
    expect((await me(adminSession)).status).toBe(200);
  });
});

describe('AUTH-15 — a token only works in the app it was issued for', () => {
  it('a mobile session cannot reach admin routes; an admin session cannot reach mobile routes', async () => {
    const player = await createUser();
    const admin = await createUser({ role: 'SUPER_ADMIN' });

    const mobileOnAdmin = await api().get('/api/v1/admin/bets').set(withCookie(`${COOKIE_NAME.mobile}=${tokenFor(player.id, 'mobile')}`));
    const mobileBearerOnAdmin = await api().get('/api/v1/admin/bets').set(sessionFor(player.id, 'mobile'));
    const adminOnMobile = await api().get('/api/v1/wallet').set(sessionFor(admin.id, 'admin'));

    expect(mobileOnAdmin.status).toBe(401);
    expect(mobileBearerOnAdmin.status).toBe(401);
    expect(adminOnMobile.status).toBe(401);
  });

  it('copying a token into the other app\'s cookie does not help: the token must claim that app', async () => {
    const admin = await createUser({ role: 'SUPER_ADMIN' });
    const adminToken = tokenFor(admin.id, 'admin');
    const player = await createUser();
    const playerToken = tokenFor(player.id, 'mobile');

    const adminTokenInMobileCookie = await api().get('/api/v1/events').set(withCookie(`${COOKIE_NAME.mobile}=${adminToken}`));
    const mobileTokenInAdminCookie = await api().get('/api/v1/admin/bets').set(withCookie(`${COOKIE_NAME.admin}=${playerToken}`));

    expect(adminTokenInMobileCookie.status).toBe(401);
    expect(mobileTokenInAdminCookie.status).toBe(401);
  });

  it('endpoints shared by both apps accept either (events/markets/crypto/auth)', async () => {
    const player = await createUser();
    const admin = await createUser({ role: 'SUPER_ADMIN' });

    for (const headers of [sessionFor(player.id, 'mobile'), sessionFor(admin.id, 'admin')]) {
      expect((await api().get('/api/v1/events').set(headers)).status).toBe(200);
      expect((await me(headers)).status).toBe(200);
    }
  });

  it('a stale cookie of one app does not lock out a valid session of the other', async () => {
    const player = await createUser();
    const admin = await createUser({ role: 'SUPER_ADMIN' });
    await prisma.user.update({ where: { id: player.id }, data: { isDeleted: 1 } });

    // The mobile cookie is tried first and is dead; the admin one must still be honoured.
    const res = await me(withCookie(`${COOKIE_NAME.mobile}=${tokenFor(player.id, 'mobile')}; ${COOKIE_NAME.admin}=${tokenFor(admin.id, 'admin')}`));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(admin.id);
  });
});

describe('AUTH-16 — the old shared admin secret is gone', () => {
  it.each([
    ['admin route', '/api/v1/admin/bets'],
    ['admin route with an id', '/api/v1/admin/wallet-requests'],
    ['events', '/api/v1/events'],
    ['auth/me', '/api/v1/auth/me'],
  ])('X-Admin-Token on %s → 401', async (_label, path) => {
    for (const value of ['dev-admin-token', 'anything', '']) {
      const res = await api().get(path).set('X-Admin-Token', value);
      expect(res.status, `${path} with "${value}"`).toBe(401);
    }
  });

  it('is not honoured even alongside a real player session', async () => {
    const player = await createUser();

    const res = await api().get('/api/v1/admin/bets').set(sessionFor(player.id, 'mobile')).set('X-Admin-Token', 'dev-admin-token');

    expect(res.status).toBe(401);
  });
});
