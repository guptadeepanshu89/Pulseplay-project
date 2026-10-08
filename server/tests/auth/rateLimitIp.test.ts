import { describe, expect, it } from 'vitest';

import { api } from '../helpers/app';
import { createUser, DEFAULT_PASSWORD } from '../helpers/factories';

// AUTH-17 (per address): one IP spraying guesses across many accounts. Own
// file because the limiter's counters are per test file and this one burns
// the whole per-IP budget.

describe('AUTH-17 — brute-force protection per ip', () => {
  it('after 100 failures spread over 100 different accounts, that address is refused — even with valid credentials', async () => {
    const legit = await createUser();

    for (let i = 0; i < 100; i += 1) {
      const res = await api().post('/api/v1/auth/login').send({ identifier: `ghost${i}@nowhere.test`, password: 'wrong-password-1' });
      expect(res.status, `failure ${i + 1}`).toBe(401); // every identifier is unique → the per-account limit is never the one that trips
    }

    const refused = await api().post('/api/v1/auth/login').send({ identifier: legit.email, password: DEFAULT_PASSWORD });
    expect(refused.status).toBe(429);
    expect(refused.body.code).toBe('RATE_LIMITED');
    expect(Number(refused.headers['retry-after'])).toBeGreaterThan(0);
  }, 90_000);
});
