import { prisma } from '../db';

// The roles the authorization layer is built on. Unlike lookup values (fully
// DB-driven), these are security-critical and referenced by name all over the
// policy code, so the list lives here AND is asserted at boot: a missing role
// must stop the server, never silently turn `roleId === undefined` checks
// into an authorization bug.
export const ROLE_CODES = ['SUPER_ADMIN', 'CLIENT_ADMIN', 'CLIENT_USER'] as const;
export type RoleCode = (typeof ROLE_CODES)[number];

// Roles are immutable reference data (seeded by a migration, never edited at
// runtime), so this is loaded once at boot — no periodic refresh.
export const ROLE_IDS = {} as Record<RoleCode, number>;

const codeById = new Map<number, RoleCode>();

export async function loadRoleCache(): Promise<void> {
  const roles = await prisma.role.findMany({ where: { isDeleted: 0 } });
  const byCode = new Map(roles.map((role) => [role.code, role.id]));

  const missing = ROLE_CODES.filter((code) => !byCode.has(code));
  if (missing.length > 0) {
    throw new Error(`Role cache is missing required roles: ${missing.join(', ')} — has the RBAC migration run?`);
  }

  codeById.clear();
  for (const code of ROLE_CODES) {
    const id = byCode.get(code)!;
    ROLE_IDS[code] = id;
    codeById.set(id, code);
  }
}

// Fail closed: an unknown role id is a bug or tampered data, never "no permissions".
export function roleCodeOf(roleId: number): RoleCode {
  const code = codeById.get(roleId);
  if (!code) throw new Error(`Unknown role id ${roleId}`);
  return code;
}
