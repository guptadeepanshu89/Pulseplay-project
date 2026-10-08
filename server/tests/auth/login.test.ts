import bcrypt from 'bcryptjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { COOKIE_NAME } from '../../src/core/tokens';
import { RoleCode } from '../../src/lib/roleCache';
import { api, bearer, withCookie } from '../helpers/app';
import { createClient, createUser, DEFAULT_PASSWORD } from '../helpers/factories';
import { prisma } from '../helpers/db';

// NOTE: the login rate limiter keeps its counters in memory for the life of
// this file (see rateLimit*.test.ts for its own tests), so no identifier here
// may fail more than a handful of times, and the file as a whole stays far
// below 100 failed attempts.

const login = (body: Record<string, unknown>) => api().post('/api/v1/auth/login').send(body);
const setCookies = (res: { headers: Record<string, unknown> }) => (res.headers['set-cookie'] ?? []) as unknown as string[];

// Exactly the fields a client may see about a user — anything else leaking
// (passwordHash, isActive, roleId, clientId, lastLoginIp, ...) fails AUTH-18.
const USER_DTO_KEYS = ['client', 'email', 'id', 'mobile', 'mustChangePassword', 'name', 'role', 'userCode'];

afterEach(() => vi.restoreAllMocks());

describe('AUTH-01 — a player signs in through the mobile app', () => {
  it.each([
    ['email', (u: { email: string }) => u.email],
    ['mixed-case email', (u: { email: string }) => u.email.toUpperCase()],
    ['padded email', (u: { email: string }) => `  ${u.email}  `],
    ['mobile number', (u: { mobile: string }) => u.mobile],
  ])('with their %s', async (_label, identifierOf) => {
    const player = await createUser({ role: 'CLIENT_USER' });

    const res = await login({ identifier: identifierOf(player), password: DEFAULT_PASSWORD, app: 'mobile' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ id: player.id, role: 'CLIENT_USER', mustChangePassword: false });
    expect(res.body.user.client).toMatchObject({ id: player.clientId });

    const cookie = setCookies(res).find((c) => c.startsWith(`${COOKIE_NAME.mobile}=`));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Max-Age=604800\b/); // 7 days
    expect(cookie).toMatch(/SameSite=Lax/);
  });

  it('defaults to the mobile app when `app` is omitted (existing builds do not send it)', async () => {
    const player = await createUser();

    const res = await login({ identifier: player.email, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
  });

  it('the returned token really authenticates the player', async () => {
    const player = await createUser();
    const { body } = await login({ identifier: player.email, password: DEFAULT_PASSWORD });

    const me = await api().get('/api/v1/auth/me').set(bearer(body.token));

    expect(me.status).toBe(200);
    expect(me.body.id).toBe(player.id);
  });
});

describe('AUTH-02 — staff sign in through the admin panel', () => {
  it.each<[RoleCode]>([['SUPER_ADMIN'], ['CLIENT_ADMIN']])('%s: cookie only, never a token in the body', async (role) => {
    const staff = await createUser({ role });

    const res = await login({ identifier: staff.email, password: DEFAULT_PASSWORD, app: 'admin' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeUndefined();
    expect(res.body.user).toMatchObject({ id: staff.id, role });
    expect(res.body.user.client === null).toBe(role === 'SUPER_ADMIN');

    const cookie = setCookies(res).find((c) => c.startsWith(`${COOKIE_NAME.admin}=`));
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Max-Age=28800\b/); // 8 hours
    expect(setCookies(res).some((c) => c.startsWith(`${COOKIE_NAME.mobile}=`))).toBe(false);
  });
});

describe('AUTH-03 — each role signs in through its own app only', () => {
  it.each<[RoleCode, 'mobile' | 'admin']>([
    ['CLIENT_USER', 'admin'],
    ['SUPER_ADMIN', 'mobile'],
    ['CLIENT_ADMIN', 'mobile'],
  ])('%s via %s → 403 WRONG_APP, nothing issued', async (role, app) => {
    const user = await createUser({ role });

    const res = await login({ identifier: user.email, password: DEFAULT_PASSWORD, app });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('WRONG_APP');
    expect(res.body.token).toBeUndefined();
    expect(setCookies(res)).toEqual([]);
  });

  it('a wrong password is still a plain 401 — the app mismatch is not revealed to a non-owner', async () => {
    const admin = await createUser({ role: 'SUPER_ADMIN' });

    const res = await login({ identifier: admin.email, password: 'not-the-password1', app: 'mobile' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('AUTH-04 — no way to tell "no such user" from "wrong password"', () => {
  it('returns byte-identical 401 bodies', async () => {
    const player = await createUser();

    const wrongPassword = await login({ identifier: player.email, password: 'definitely-wrong-1' });
    const unknownUser = await login({ identifier: 'nobody@nowhere.test', password: 'definitely-wrong-1' });

    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.status).toBe(401);
    expect(unknownUser.body).toEqual(wrongPassword.body);
    expect(wrongPassword.body).toEqual({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
  });

  it('spends a bcrypt comparison on an unknown identifier too (so response time does not reveal it)', async () => {
    const compare = vi.spyOn(bcrypt, 'compare');

    await login({ identifier: 'ghost@nowhere.test', password: 'whatever-123' });

    expect(compare).toHaveBeenCalledTimes(1);
    expect(compare.mock.calls[0][1]).toMatch(/^\$2[aby]\$/); // compared against a real (dummy) hash
  });

  it('also refuses to reveal an unknown *mobile number*', async () => {
    const res = await login({ identifier: '9999999999', password: 'whatever-123' });

    expect(res.body).toEqual({ error: 'Invalid credentials', code: 'INVALID_CREDENTIALS' });
  });
});

describe('AUTH-05 — blocked accounts', () => {
  it('with the right password → 403 ACCOUNT_BLOCKED', async () => {
    const player = await createUser({ isActive: 0 });

    const res = await login({ identifier: player.email, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ACCOUNT_BLOCKED');
    expect(res.body.token).toBeUndefined();
    expect(setCookies(res)).toEqual([]);
  });

  it('with a wrong password → the generic 401, so "blocked" cannot be used to confirm an identifier', async () => {
    const player = await createUser({ isActive: 0 });

    const res = await login({ identifier: player.email, password: 'wrong-password-1' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('AUTH-06 — soft-deleted accounts', () => {
  it('cannot sign in, and look exactly like an unknown user', async () => {
    const gone = await createUser({ isDeleted: 1 });

    const res = await login({ identifier: gone.email, password: DEFAULT_PASSWORD });
    const unknown = await login({ identifier: 'nobody@nowhere.test', password: DEFAULT_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body).toEqual(unknown.body);
  });
});

describe('AUTH-07 — accounts of an inactive / deleted client', () => {
  it.each<[RoleCode, 'mobile' | 'admin']>([
    ['CLIENT_USER', 'mobile'],
    ['CLIENT_ADMIN', 'admin'],
  ])('%s of an inactive client → 403 CLIENT_INACTIVE (only after the password checks out)', async (role, app) => {
    const client = await createClient({ isActive: 0 });
    const user = await createUser({ role, clientId: client.id });

    const right = await login({ identifier: user.email, password: DEFAULT_PASSWORD, app });
    const wrong = await login({ identifier: user.email, password: 'wrong-password-1', app });

    expect(right.status).toBe(403);
    expect(right.body.code).toBe('CLIENT_INACTIVE');
    expect(wrong.status).toBe(401);
  });

  it('a user of a deleted client is a plain 401', async () => {
    const client = await createClient({ isDeleted: 1 });
    const user = await createUser({ clientId: client.id });

    const res = await login({ identifier: user.email, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('a SuperAdmin has no client and is unaffected by any client being inactive', async () => {
    await createClient({ isActive: 0 });
    const admin = await createUser({ role: 'SUPER_ADMIN' });

    const res = await login({ identifier: admin.email, password: DEFAULT_PASSWORD, app: 'admin' });

    expect(res.status).toBe(200);
  });
});

describe('AUTH-08 — a temporary password can only be used to change it', () => {
  it('login succeeds and reports the flag', async () => {
    const player = await createUser({ mustChangePassword: 1 });

    const res = await login({ identifier: player.email, password: DEFAULT_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.mustChangePassword).toBe(true);
  });

  it('allows /auth/me, /auth/change-password and /auth/logout — and nothing else', async () => {
    const player = await createUser({ mustChangePassword: 1 });
    const { body } = await login({ identifier: player.email, password: DEFAULT_PASSWORD });
    const auth = bearer(body.token);

    expect((await api().get('/api/v1/auth/me').set(auth)).status).toBe(200);
    expect((await api().post('/api/v1/auth/logout').send({})).status).toBe(204);

    for (const path of ['/api/v1/wallet', '/api/v1/bets', '/api/v1/events', '/api/v1/notifications']) {
      const blocked = await api().get(path).set(auth);
      expect(blocked.status, path).toBe(403);
      expect(blocked.body.code, path).toBe('PASSWORD_CHANGE_REQUIRED');
    }
  });

  it('applies to staff on the admin panel too', async () => {
    const admin = await createUser({ role: 'SUPER_ADMIN', mustChangePassword: 1 });
    const res = await login({ identifier: admin.email, password: DEFAULT_PASSWORD, app: 'admin' });
    const cookie = setCookies(res).find((c) => c.startsWith(`${COOKIE_NAME.admin}=`))!.split(';')[0];

    const blocked = await api().get('/api/v1/admin/bets').set(withCookie(cookie));

    expect(blocked.status).toBe(403);
    expect(blocked.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
  });

  it('changing the password lifts the gate', async () => {
    const player = await createUser({ mustChangePassword: 1 });
    const { body } = await login({ identifier: player.email, password: DEFAULT_PASSWORD });

    const changed = await api()
      .post('/api/v1/auth/change-password')
      .set(bearer(body.token))
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'a-brand-new-pass-9' });

    expect(changed.status).toBe(200);
    const after = await api().get('/api/v1/wallet').set(bearer(changed.body.token));
    expect(after.status).not.toBe(403);
  });
});

describe('AUTH-09 — changing the password', () => {
  const change = (token: string, body: Record<string, unknown>) =>
    api().post('/api/v1/auth/change-password').set(bearer(token)).send(body);

  async function signedInPlayer(overrides: Parameters<typeof createUser>[0] = {}) {
    const user = await createUser(overrides);
    const { body } = await login({ identifier: user.email, password: DEFAULT_PASSWORD });
    return { user, token: body.token as string };
  }

  it('requires a session', async () => {
    const res = await api().post('/api/v1/auth/change-password').send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'new-password-1' });
    expect(res.status).toBe(401);
  });

  it('wrong current password → 400 INVALID_CURRENT_PASSWORD (not 401: that would log the app out)', async () => {
    const { token } = await signedInPlayer();

    const res = await change(token, { currentPassword: 'wrong-password-1', newPassword: 'new-password-1' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  it.each([
    ['too short', 'abc123'],
    ['no digit', 'onlyletterspassword'],
    ['no letter', '1234567890123'],
    ['too long', `a1${'x'.repeat(200)}`],
  ])('weak new password (%s) → 400 VALIDATION_ERROR', async (_label, newPassword) => {
    const { token } = await signedInPlayer();

    const res = await change(token, { currentPassword: DEFAULT_PASSWORD, newPassword });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });

  it('same as the old password → 400 PASSWORD_UNCHANGED', async () => {
    const { token } = await signedInPlayer();

    const res = await change(token, { currentPassword: DEFAULT_PASSWORD, newPassword: DEFAULT_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PASSWORD_UNCHANGED');
  });

  it('a failed attempt changes nothing', async () => {
    const { user, token } = await signedInPlayer();

    await change(token, { currentPassword: 'wrong-password-1', newPassword: 'new-password-1' });

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.passwordChangedAt).toBeNull();
    expect(await bcrypt.compare(DEFAULT_PASSWORD, row.passwordHash)).toBe(true);
  });

  it('success: new password works, old one does not, flag cleared, audit fields set, fresh token returned', async () => {
    const { user, token } = await signedInPlayer({ mustChangePassword: 1 });

    const res = await change(token, { currentPassword: DEFAULT_PASSWORD, newPassword: 'new-password-1' });

    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.token).not.toBe(token);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(row.mustChangePassword).toBe(0);
    expect(row.passwordChangedAt).toBeInstanceOf(Date);
    expect(row.modifiedByUserId).toBe(user.id);

    expect((await login({ identifier: user.email, password: DEFAULT_PASSWORD })).status).toBe(401);
    expect((await login({ identifier: user.email, password: 'new-password-1' })).status).toBe(200);
  });

  it('on the admin panel the new token travels in the cookie only', async () => {
    const admin = await createUser({ role: 'SUPER_ADMIN' });
    const signIn = await login({ identifier: admin.email, password: DEFAULT_PASSWORD, app: 'admin' });
    const cookie = setCookies(signIn).find((c) => c.startsWith(`${COOKIE_NAME.admin}=`))!.split(';')[0];

    const res = await api()
      .post('/api/v1/auth/change-password')
      .set(withCookie(cookie))
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'new-password-1' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    const fresh = setCookies(res).find((c) => c.startsWith(`${COOKIE_NAME.admin}=`))!.split(';')[0];
    expect(fresh).not.toBe(cookie);
    expect((await api().get('/api/v1/auth/me').set(withCookie(fresh))).status).toBe(200);
  });

  it('rejects unknown fields (no smuggling passwordHash / roleId in)', async () => {
    const { token } = await signedInPlayer();

    const res = await change(token, { currentPassword: DEFAULT_PASSWORD, newPassword: 'new-password-1', passwordHash: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});

describe('AUTH-18 — responses never leak internals', () => {
  it('login and /auth/me expose exactly the public user fields, for every role', async () => {
    for (const role of ['CLIENT_USER', 'CLIENT_ADMIN', 'SUPER_ADMIN'] as const) {
      const user = await createUser({ role });
      const app = role === 'CLIENT_USER' ? 'mobile' : 'admin';
      const signIn = await login({ identifier: user.email, password: DEFAULT_PASSWORD, app });
      const cookie = setCookies(signIn).find((c) => c.startsWith(`${COOKIE_NAME[app]}=`))!.split(';')[0];
      const me = await api().get('/api/v1/auth/me').set(withCookie(cookie));

      for (const body of [signIn.body.user, me.body]) {
        expect(Object.keys(body).sort(), role).toEqual(USER_DTO_KEYS);
      }
      expect(JSON.stringify([signIn.body, me.body])).not.toMatch(/passwordHash|\$2[aby]\$/);
    }
  });

  it('failure bodies carry only { error, code }', async () => {
    const res = await login({ identifier: 'nobody@nowhere.test', password: 'whatever-123' });
    expect(Object.keys(res.body).sort()).toEqual(['code', 'error']);
  });
});

describe('AUTH-19 — last-login bookkeeping', () => {
  it('is untouched by failures (incl. a blocked account) and set by a success', async () => {
    const player = await createUser();
    const blocked = await createUser({ isActive: 0 });

    await login({ identifier: player.email, password: 'wrong-password-1' });
    await login({ identifier: blocked.email, password: DEFAULT_PASSWORD });
    for (const id of [player.id, blocked.id]) {
      const row = await prisma.user.findUniqueOrThrow({ where: { id } });
      expect(row.lastLoginAt, `user ${id}`).toBeNull();
      expect(row.lastLoginIp, `user ${id}`).toBeNull();
    }

    await login({ identifier: player.email, password: DEFAULT_PASSWORD });
    const row = await prisma.user.findUniqueOrThrow({ where: { id: player.id } });
    expect(row.lastLoginAt).toBeInstanceOf(Date);
    expect(row.lastLoginIp).toEqual(expect.any(String));
  });
});

describe('AUTH-20 — logout', () => {
  const clearedCookies = (res: { headers: Record<string, unknown> }, name: string) =>
    setCookies(res).filter((c) => c.startsWith(`${name}=;`) && /Expires=Thu, 01 Jan 1970/.test(c));

  it('answers 204 and clears the mobile cookie by default', async () => {
    const res = await api().post('/api/v1/auth/logout').send({});

    expect(res.status).toBe(204);
    expect(clearedCookies(res, COOKIE_NAME.mobile)).toHaveLength(1);
    expect(clearedCookies(res, COOKIE_NAME.admin)).toHaveLength(0);
  });

  it('clears the admin cookie when asked for the admin app', async () => {
    const res = await api().post('/api/v1/auth/logout').send({ app: 'admin' });

    expect(res.status).toBe(204);
    expect(clearedCookies(res, COOKIE_NAME.admin)).toHaveLength(1);
    expect(clearedCookies(res, COOKIE_NAME.mobile)).toHaveLength(0);
  });

  it('needs no session and no body (idempotent), but rejects an unknown app', async () => {
    expect((await api().post('/api/v1/auth/logout')).status).toBe(204);
    expect((await api().post('/api/v1/auth/logout').send({ app: 'superadmin' })).status).toBe(400);
  });
});

describe('login input validation', () => {
  it.each([
    ['missing password', { identifier: 'a@b.test' }],
    ['missing identifier', { password: 'x' }],
    ['empty identifier', { identifier: '   ', password: 'x' }],
    ['unknown field', { identifier: 'a@b.test', password: 'x', isAdmin: true }],
    ['invalid app', { identifier: 'a@b.test', password: 'x', app: 'superadmin' }],
    ['non-string identifier', { identifier: { $ne: '' }, password: 'x' }],
    ['non-string password', { identifier: 'a@b.test', password: ['x'] }],
    ['oversized password', { identifier: 'a@b.test', password: 'x'.repeat(201) }],
  ])('%s → 400 VALIDATION_ERROR', async (_label, body) => {
    const res = await login(body);

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
