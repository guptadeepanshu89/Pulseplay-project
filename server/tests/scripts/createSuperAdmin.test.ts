import { execFileSync } from 'node:child_process';
import bcrypt from 'bcryptjs';
import { describe, expect, it } from 'vitest';

import { newPasswordSchema } from '../../src/core/password';
import { createSuperAdmin, SuperAdminError } from '../../src/modules/users/superAdmin';
import { api, withCookie } from '../helpers/app';
import { prisma } from '../helpers/db';
import { createUser } from '../helpers/factories';
import { TEST_ENV } from '../testEnv';

const valid = { name: 'Asha Verma', email: 'Asha.Verma@Example.com', mobile: '9876543210' };

describe('CLI-01 — createSuperAdmin (the only way a SUPER_ADMIN is made)', () => {
  it('creates a client-less SUPER_ADMIN who must change a generated password at first login', async () => {
    const { userId, email, password } = await createSuperAdmin(valid);

    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { role: true } });
    expect(row.role.code).toBe('SUPER_ADMIN');
    expect(row.clientId).toBeNull();
    expect(row.mustChangePassword).toBe(1);
    expect(row.isActive).toBe(1);
    expect(row.isDeleted).toBe(0);
    expect(row.email).toBe('asha.verma@example.com');
    expect(email).toBe('asha.verma@example.com');
    expect(row.passwordHash).not.toContain(password);
    expect(await bcrypt.compare(password, row.passwordHash)).toBe(true);
    expect(newPasswordSchema.safeParse(password).success).toBe(true);
    expect(password).toHaveLength(16);
  });

  it('the account can sign in to the panel, but only to change its password', async () => {
    const { email, password } = await createSuperAdmin(valid);

    const signIn = await api().post('/api/v1/auth/login').send({ identifier: email, password, app: 'admin' });
    expect(signIn.status).toBe(200);
    expect(signIn.body.user.mustChangePassword).toBe(true);
    const cookie = (signIn.headers['set-cookie'] as unknown as string[])[0].split(';')[0];

    const gated = await api().get('/api/v1/admin/bets').set(withCookie(cookie));
    expect(gated.status).toBe(403);
    expect(gated.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

    const changed = await api().post('/api/v1/auth/change-password').set(withCookie(cookie)).send({ currentPassword: password, newPassword: 'My-own-passw0rd!' });
    expect(changed.status).toBe(200);
    const fresh = (changed.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
    expect((await api().get('/api/v1/admin/bets').set(withCookie(fresh))).status).toBe(200);
  });

  it('every call generates a different password', async () => {
    const first = await createSuperAdmin(valid);
    const second = await createSuperAdmin({ name: 'Second Admin', email: 'second@example.com', mobile: '9876543211' });

    expect(second.password).not.toBe(first.password);
  });

  it.each([
    ['a taken email (any case)', { ...valid, email: 'EXISTING@example.com', mobile: '9000000001' }, /email already exists/],
    ['a taken mobile number', { ...valid, email: 'fresh@example.com', mobile: '9000000002' }, /mobile number already exists/],
  ])('refuses %s, and creates nothing', async (_label, input, message) => {
    await createUser({ email: 'existing@example.com', mobile: '9000000002' });
    const before = await prisma.user.count();

    await expect(createSuperAdmin(input)).rejects.toThrow(message);
    expect(await prisma.user.count()).toBe(before);
  });

  it('a soft-deleted user still owns their email (uniqueness is absolute)', async () => {
    await createUser({ email: 'gone@example.com', isDeleted: 1 });

    await expect(createSuperAdmin({ ...valid, email: 'gone@example.com' })).rejects.toBeInstanceOf(SuperAdminError);
  });

  it.each([
    ['empty name', { ...valid, name: '  ' }],
    ['bad email', { ...valid, email: 'not-an-email' }],
    ['letters in the mobile number', { ...valid, mobile: '98765abc10' }],
    ['a mobile number that is too short', { ...valid, mobile: '12345' }],
  ])('rejects %s', async (_label, input) => {
    await expect(createSuperAdmin(input)).rejects.toBeInstanceOf(SuperAdminError);
    expect(await prisma.user.count()).toBe(0);
  });
});

describe('CLI-02 — `npm run create-superadmin`', () => {
  // No shell: arguments reach the script exactly as given (a shell would split "Cli Admin").
  const run = (args: string[]) =>
    execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'src/scripts/createSuperAdmin.ts', ...args], {
      cwd: process.cwd(),
      env: { ...process.env, ...TEST_ENV },
      encoding: 'utf8',
      stdio: 'pipe',
    });

  const failureOf = (args: string[]) => {
    try {
      run(args);
    } catch (error) {
      return error as { status?: number; stderr?: string };
    }
    throw new Error('expected the script to fail');
  };

  it('creates the user and prints the credentials once', async () => {
    const output = run(['--name', 'Cli Admin', '--email', 'cli.admin@example.com', '--mobile', '9123456789']);

    const password = /password:\s+(\S+)/.exec(output)?.[1];
    expect(output).toContain('cli.admin@example.com');
    expect(password).toBeDefined();
    expect(newPasswordSchema.safeParse(password).success).toBe(true);

    const row = await prisma.user.findUniqueOrThrow({ where: { email: 'cli.admin@example.com' }, include: { role: true } });
    expect(row.role.code).toBe('SUPER_ADMIN');
    expect(await bcrypt.compare(password!, row.passwordHash)).toBe(true);
  });

  const NO_STACK_TRACE = /\n\s+at .*[(:]\d+:\d+/;

  it('exits non-zero with usage when arguments are missing, and creates nothing', async () => {
    const failure = failureOf(['--email', 'only.email@example.com']);

    expect(failure.status).toBe(1);
    expect(failure.stderr).toMatch(/Usage: npm run create-superadmin/);
    expect(failure.stderr).not.toMatch(NO_STACK_TRACE);
    expect(await prisma.user.count()).toBe(0);
  });

  it('exits non-zero with usage (not a stack trace) when the name was not quoted', async () => {
    const failure = failureOf(['--name', 'Cli', 'Admin', '--email', 'cli@example.com', '--mobile', '9123456789']);

    expect(failure.status).toBe(1);
    expect(failure.stderr).toMatch(/Error: .*Usage: npm run create-superadmin/s);
    expect(failure.stderr).not.toMatch(NO_STACK_TRACE);
    expect(await prisma.user.count()).toBe(0);
  });

  it('exits non-zero with a plain message (no stack trace) for a duplicate', async () => {
    await createUser({ email: 'dup@example.com' });

    const failure = failureOf(['--name', 'Dup', '--email', 'dup@example.com', '--mobile', '9222222222']);

    expect(failure.status).toBe(1);
    expect(failure.stderr).toMatch(/Error: A user with that email already exists/);
    expect(failure.stderr).not.toMatch(NO_STACK_TRACE);
  });
});
