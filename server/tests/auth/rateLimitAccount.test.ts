import { afterEach, describe, expect, it, vi } from 'vitest';

import { api } from '../helpers/app';
import { createUser, DEFAULT_PASSWORD } from '../helpers/factories';

// AUTH-17 (per identifier). The limiter's counters live in memory for the
// life of the test file, so this scenario has a file of its own; the per-IP
// limit is exercised in rateLimitIp.test.ts.

const login = (identifier: string, password: string) => api().post('/api/v1/auth/login').send({ identifier, password });
const fail = (identifier: string) => login(identifier, 'wrong-password-1');

afterEach(() => vi.useRealTimers());

describe('AUTH-17 — brute-force protection per (ip, identifier)', () => {
  it('allows 10 failures, then answers 429 RATE_LIMITED with Retry-After — even for the right password', async () => {
    const victim = await createUser();

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      expect((await fail(victim.email)).status, `attempt ${attempt}`).toBe(401);
    }
    const blocked = await login(victim.email, DEFAULT_PASSWORD);

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ error: 'Too many failed login attempts — try again later', code: 'RATE_LIMITED' });
    const retryAfter = Number(blocked.headers['retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(15 * 60);
  });

  it('does not throttle other accounts from the same address', async () => {
    const other = await createUser();

    expect((await login(other.email, DEFAULT_PASSWORD)).status).toBe(200);
  });

  it('the block looks the same whether or not the identifier exists', async () => {
    const real = await createUser();
    for (let i = 0; i < 10; i += 1) await fail(real.email);
    for (let i = 0; i < 10; i += 1) await fail('ghost@nowhere.test');

    const realBlocked = await fail(real.email);
    const ghostBlocked = await fail('ghost@nowhere.test');

    expect(realBlocked.status).toBe(429);
    expect(ghostBlocked.status).toBe(429);
    expect(ghostBlocked.body).toEqual(realBlocked.body);
  });

  it('spelling the identifier differently (case, padding) does not buy extra guesses', async () => {
    const target = await createUser();

    for (let i = 0; i < 5; i += 1) await fail(target.email);
    for (let i = 0; i < 5; i += 1) await fail(`  ${target.email.toUpperCase()}  `);

    expect((await fail(target.email.toUpperCase())).status).toBe(429);
  });

  it('successful logins are never counted: a user can sign in over and over', async () => {
    const busy = await createUser();

    for (let i = 0; i < 15; i += 1) {
      expect((await login(busy.email, DEFAULT_PASSWORD)).status, `login ${i}`).toBe(200);
    }
  });

  it('a success in between does not reset the failure count of that bucket (failures still add up)', async () => {
    const user = await createUser();

    for (let i = 0; i < 9; i += 1) await fail(user.email);
    expect((await login(user.email, DEFAULT_PASSWORD)).status).toBe(200);
    expect((await fail(user.email)).status).toBe(401); // the 10th failure
    expect((await fail(user.email)).status).toBe(429); // the 11th is refused
  });

  it('the window is 15 minutes: after it, the counter starts over', async () => {
    const user = await createUser();
    for (let i = 0; i < 11; i += 1) await fail(user.email);
    expect((await login(user.email, DEFAULT_PASSWORD)).status).toBe(429);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 15 * 60 * 1000 + 1000);

    expect((await login(user.email, DEFAULT_PASSWORD)).status).toBe(200);
  });
});
