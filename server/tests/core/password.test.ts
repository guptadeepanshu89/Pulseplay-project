import { describe, expect, it } from 'vitest';

import { generateTempPassword, newPasswordSchema } from '../../src/core/password';

describe('SC-05 — temporary passwords', () => {
  const draws = Array.from({ length: 300 }, () => generateTempPassword());

  it('are 16 characters and always satisfy the password policy', () => {
    for (const password of draws) {
      expect(password).toHaveLength(16);
      expect(newPasswordSchema.safeParse(password).success, password).toBe(true);
    }
  });

  it('avoid look-alike characters (I, O, l, 0, 1) so they can be read out and typed', () => {
    for (const password of draws) expect(password).not.toMatch(/[IOl01]/);
  });

  it('do not repeat (300 draws, all different)', () => {
    expect(new Set(draws).size).toBe(draws.length);
  });
});

describe('password policy', () => {
  it.each([
    ['exactly 10 chars, letter + digit', 'abcdefghi1', true],
    ['9 chars', 'abcdefgh1', false],
    ['no digit', 'abcdefghijk', false],
    ['no letter', '12345678901', false],
    ['128 chars', `a1${'x'.repeat(126)}`, true],
    ['129 chars', `a1${'x'.repeat(127)}`, false],
  ])('%s', (_label, password, ok) => {
    expect(newPasswordSchema.safeParse(password).success).toBe(ok);
  });
});
