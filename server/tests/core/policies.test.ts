import { describe, expect, it } from 'vitest';

import { ACTIONS, Action, can, PolicyActor, PolicyTarget } from '../../src/core/policies';
import { RoleCode } from '../../src/lib/roleCache';

// The matrix is written out here as DATA, independently of the implementation
// (§5.4 of the plan). Change a rule in code without changing this table — or
// add an action without a row — and the suite fails.

const MINE = 5; // the actor's client
const OTHER = 6;

const actor = (role: RoleCode, clientId: number | null = role === 'SUPER_ADMIN' ? null : MINE): PolicyActor => ({
  userId: 100,
  role,
  clientId,
});

type Row = [action: Action, role: RoleCode, target: PolicyTarget, expected: boolean, why: string];

const rows: Row[] = [
  // ---- clients
  ['client.manage', 'SUPER_ADMIN', {}, true, 'SA manages clients'],
  ['client.manage', 'CLIENT_ADMIN', { clientId: MINE }, false, 'CA cannot manage even his own client record'],
  ['client.manage', 'CLIENT_USER', {}, false, 'CU never'],

  // ---- creating accounts
  ['user.create', 'SUPER_ADMIN', { role: 'CLIENT_ADMIN', clientId: MINE }, true, 'SA creates a Client Admin'],
  ['user.create', 'SUPER_ADMIN', { role: 'CLIENT_USER', clientId: OTHER }, true, 'SA creates a player anywhere'],
  ['user.create', 'SUPER_ADMIN', { role: 'CLIENT_USER' }, false, 'a player must be created inside a named client'],
  ['user.create', 'SUPER_ADMIN', { role: 'SUPER_ADMIN' }, false, 'nobody creates a SuperAdmin through the API'],
  ['user.create', 'CLIENT_ADMIN', { role: 'CLIENT_USER', clientId: MINE }, true, 'CA creates a player in his own client'],
  ['user.create', 'CLIENT_ADMIN', { role: 'CLIENT_USER', clientId: OTHER }, false, 'not in another client'],
  ['user.create', 'CLIENT_ADMIN', { role: 'CLIENT_ADMIN', clientId: MINE }, false, 'CA cannot mint another admin'],
  ['user.create', 'CLIENT_ADMIN', { role: 'SUPER_ADMIN' }, false, 'never a SuperAdmin'],
  ['user.create', 'CLIENT_USER', { role: 'CLIENT_USER', clientId: MINE }, false, 'players create nobody'],

  // ---- viewing users
  ['user.view', 'SUPER_ADMIN', { clientId: OTHER }, true, 'SA sees everyone'],
  ['user.view', 'CLIENT_ADMIN', { clientId: MINE }, true, 'CA sees his own client'],
  ['user.view', 'CLIENT_ADMIN', { clientId: OTHER }, false, 'not another client'],
  ['user.view', 'CLIENT_USER', { clientId: MINE, userId: 100 }, false, 'even self goes through /auth/me, not the admin view'],
];

// update / block / resetPassword / delete share one rule.
for (const action of ['user.update', 'user.block', 'user.resetPassword', 'user.delete'] as const) {
  rows.push(
    [action, 'SUPER_ADMIN', { role: 'CLIENT_USER', clientId: OTHER }, true, 'SA manages a player anywhere'],
    [action, 'SUPER_ADMIN', { role: 'CLIENT_ADMIN', clientId: OTHER }, true, 'SA manages a Client Admin'],
    [action, 'SUPER_ADMIN', { role: 'SUPER_ADMIN' }, false, 'SuperAdmins are not managed through the API (incl. self)'],
    [action, 'CLIENT_ADMIN', { role: 'CLIENT_USER', clientId: MINE }, true, 'CA manages his own players'],
    [action, 'CLIENT_ADMIN', { role: 'CLIENT_USER', clientId: OTHER }, false, 'not another client\'s players'],
    [action, 'CLIENT_ADMIN', { role: 'CLIENT_ADMIN', clientId: MINE }, false, 'nor a fellow admin (incl. himself)'],
    [action, 'CLIENT_ADMIN', { role: 'SUPER_ADMIN' }, false, 'nor a SuperAdmin'],
    [action, 'CLIENT_USER', { role: 'CLIENT_USER', clientId: MINE, userId: 100 }, false, 'players manage no one, not even themselves here'],
  );
}

rows.push(
  // ---- fund requests
  ['fundRequest.list', 'SUPER_ADMIN', {}, true, ''],
  ['fundRequest.list', 'CLIENT_ADMIN', {}, true, ''],
  ['fundRequest.list', 'CLIENT_USER', {}, false, ''],
  ['fundRequest.resolve', 'SUPER_ADMIN', { clientId: OTHER }, true, 'SA overrides any client'],
  ['fundRequest.resolve', 'CLIENT_ADMIN', { clientId: MINE }, true, 'CA resolves his own client\'s requests'],
  ['fundRequest.resolve', 'CLIENT_ADMIN', { clientId: OTHER }, false, 'never another client\'s'],
  ['fundRequest.resolve', 'CLIENT_USER', { clientId: MINE }, false, 'players never resolve'],
  ['fundRequest.create', 'CLIENT_USER', {}, true, 'only players ask for funds'],
  ['fundRequest.create', 'CLIENT_ADMIN', {}, false, ''],
  ['fundRequest.create', 'SUPER_ADMIN', {}, false, ''],

  // ---- reporting, markets, betting
  ['bets.viewAny', 'SUPER_ADMIN', {}, true, ''],
  ['bets.viewAny', 'CLIENT_ADMIN', {}, true, 'scoped to his client by the query layer'],
  ['bets.viewAny', 'CLIENT_USER', {}, false, ''],
  ['market.manage', 'SUPER_ADMIN', {}, true, 'only SA settles markets'],
  ['market.manage', 'CLIENT_ADMIN', {}, false, ''],
  ['market.manage', 'CLIENT_USER', {}, false, ''],
  ['bet.place', 'CLIENT_USER', {}, true, ''],
  ['bet.place', 'CLIENT_ADMIN', {}, false, ''],
  ['bet.place', 'SUPER_ADMIN', {}, false, ''],
  ['wallet.use', 'CLIENT_USER', {}, true, ''],
  ['wallet.use', 'CLIENT_ADMIN', {}, false, ''],
  ['wallet.use', 'SUPER_ADMIN', {}, false, ''],
);

describe('POL — policy matrix', () => {
  it.each(rows)('POL-01 %s / %s / %j → %s (%s)', (action, role, target, expected) => {
    expect(can(action, actor(role), target)).toBe(expected);
  });

  it('POL-01b every action in the code has rows in this matrix (and vice versa)', () => {
    const covered = new Set(rows.map(([action]) => action));
    expect([...covered].sort()).toEqual([...ACTIONS].sort());
  });

  it('POL-02 a CLIENT_USER is denied every admin-side action against any target', () => {
    const playerOnly: Action[] = ['fundRequest.create', 'bet.place', 'wallet.use'];
    const targets: PolicyTarget[] = [{}, { clientId: MINE }, { clientId: OTHER }, { role: 'CLIENT_USER', clientId: MINE }, { role: 'SUPER_ADMIN' }];
    for (const action of ACTIONS.filter((a) => !playerOnly.includes(a))) {
      for (const target of targets) {
        expect(can(action, actor('CLIENT_USER'), target), `${action} ${JSON.stringify(target)}`).toBe(false);
      }
    }
  });

  it('POL-03 a CLIENT_ADMIN is denied every action aimed at another client', () => {
    const tenantActions: Action[] = ['user.create', 'user.view', 'user.update', 'user.block', 'user.resetPassword', 'user.delete', 'fundRequest.resolve'];
    for (const action of tenantActions) {
      for (const role of ['CLIENT_USER', 'CLIENT_ADMIN', undefined] as const) {
        expect(can(action, actor('CLIENT_ADMIN'), { role, clientId: OTHER }), `${action} ${role}`).toBe(false);
      }
    }
  });

  it('POL-04 fails closed: an unknown role is denied everything; an unknown action throws', () => {
    const nobody = { userId: 1, role: 'HACKER' as RoleCode, clientId: MINE };
    for (const action of ACTIONS) {
      expect(can(action, nobody, { role: 'CLIENT_USER', clientId: MINE }), action).toBe(false);
    }
    expect(() => can('made.up' as Action, actor('SUPER_ADMIN'))).toThrow(/Unknown policy action/);
  });

  it('POL-05 a client-bound actor with a NULL clientId never matches a target (no null === null leak)', () => {
    const broken = actor('CLIENT_ADMIN', null);
    expect(can('user.update', broken, { role: 'CLIENT_USER', clientId: null })).toBe(false);
    expect(can('fundRequest.resolve', broken, { clientId: null })).toBe(false);
    expect(can('user.view', broken, { clientId: null })).toBe(false);
  });
});
