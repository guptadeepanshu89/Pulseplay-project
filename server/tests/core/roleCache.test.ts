import { afterEach, describe, expect, it } from 'vitest';

import { loadRoleCache, ROLE_CODES, ROLE_IDS, roleCodeOf } from '../../src/lib/roleCache';
import { prisma } from '../helpers/db';

afterEach(async () => {
  // Roles are reference data shared by every test: always leave them intact.
  await prisma.role.updateMany({ data: { isDeleted: 0 } });
  await loadRoleCache();
});

describe('RC — role cache', () => {
  it('RC-01 loads all three roles with distinct ids that round-trip', async () => {
    await loadRoleCache();

    const ids = ROLE_CODES.map((code) => ROLE_IDS[code]);
    expect(new Set(ids).size).toBe(3);
    for (const code of ROLE_CODES) expect(roleCodeOf(ROLE_IDS[code])).toBe(code);
  });

  it('RC-02 refuses to boot when a required role is missing', async () => {
    await prisma.role.update({ where: { code: 'CLIENT_ADMIN' }, data: { isDeleted: 1 } });

    await expect(loadRoleCache()).rejects.toThrow(/missing required roles: CLIENT_ADMIN/);
  });

  it('RC-04 an unknown role id throws instead of quietly meaning "no permissions"', () => {
    expect(() => roleCodeOf(987654)).toThrow(/Unknown role id/);
  });
});
