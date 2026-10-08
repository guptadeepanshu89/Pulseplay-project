import jwt from 'jsonwebtoken';
import request from 'supertest';
import { expect } from 'vitest';

import { createApp } from '../../src/app';
import { AppKind } from '../../src/core/actor';
import { COOKIE_NAME, signToken } from '../../src/core/tokens';
import { TEST_ENV } from '../testEnv';
import { createAdminUser, DEFAULT_PASSWORD, SUPER_ADMIN_EMAIL } from './factories';

export const app = createApp();

export const api = () => request(app);

export async function loginToken(identifier: string, password = DEFAULT_PASSWORD): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ identifier, password });
  expect(res.status, `login as ${identifier}: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body.token as string;
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

// The admin panel authenticates with an httpOnly cookie, never a body token.
// Returns the "name=value" cookie pair to send back as a Cookie header.
export async function adminSession(identifier = SUPER_ADMIN_EMAIL, password = DEFAULT_PASSWORD): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ identifier, password, app: 'admin' });
  expect(res.status, `admin login as ${identifier}: ${JSON.stringify(res.body)}`).toBe(200);
  const cookies = (res.headers['set-cookie'] ?? []) as unknown as string[];
  const cookie = cookies.find((c) => c.startsWith('pulseplay_admin_token='));
  expect(cookie, 'admin login must set the admin cookie').toBeDefined();
  return cookie!.split(';')[0];
}

export const withCookie = (cookie: string) => ({ Cookie: cookie });

// A SuperAdmin user plus a live admin-panel session for it.
export async function signInAdmin(): Promise<string> {
  await createAdminUser();
  return adminSession();
}

// ---- hand-made sessions (no login round-trip) -------------------------------

// A genuine token for `userId` in `app`, exactly as login would sign it. Pass a
// non-default `passwordVersion` to mimic a token issued before/after a password change.
export const tokenFor = (userId: number, app: AppKind, passwordVersion = 0) => signToken({ userId, app, passwordVersion });

// The transport each app really uses: a Bearer header for mobile, its cookie for the panel.
export const sessionFor = (userId: number, app: AppKind, passwordVersion = 0): Record<string, string> => {
  const token = tokenFor(userId, app, passwordVersion);
  return app === 'mobile' ? bearer(token) : withCookie(`${COOKIE_NAME.admin}=${token}`);
};

// A token signed with the real secret but arbitrary claims/options: for probing
// what the verifier accepts. Use `secret` to sign with a wrong key.
export const forgeToken = (claims: Record<string, unknown>, options: jwt.SignOptions = {}, secret = TEST_ENV.JWT_SECRET) =>
  jwt.sign(claims, secret, { expiresIn: 60, ...options });
