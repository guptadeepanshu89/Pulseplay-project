import { describe, expect, it } from 'vitest';

import { app, api, sessionFor } from '../helpers/app';
import { createUser } from '../helpers/factories';
import { listRoutes } from '../helpers/routes';

// RB — role × endpoint matrix. The table below is the ONLY place that says who
// may call what; RB-04 fails when the app serves a route that is not in it, so
// a new endpoint cannot slip in without a decision about its access level.
//
//   public      no session needed
//   anyAuth     any signed-in user of either app (also while a temporary password is pending)
//   shared      read-only data every role may see (events, markets, crypto)
//   player      wallet / betting — CLIENT_USER through the mobile app only
//   scopedAdmin admin panel, SUPER_ADMIN (any client) or CLIENT_ADMIN (own client only —
//               object-level tenant scoping is exercised separately, in TN-*)
//   superAdmin  admin panel, SUPER_ADMIN only
type Access = 'public' | 'anyAuth' | 'shared' | 'player' | 'scopedAdmin' | 'superAdmin';

const MATRIX: Record<string, Access> = {
  'GET /health': 'public',
  'POST /api/v1/auth/login': 'public',
  'POST /api/v1/auth/logout': 'public',
  'GET /api/v1/auth/me': 'anyAuth',
  'POST /api/v1/auth/change-password': 'anyAuth',

  'GET /api/v1/events': 'shared',
  'GET /api/v1/events/:id': 'shared',
  'GET /api/v1/events/:eventId/markets': 'shared',
  'GET /api/v1/markets': 'shared',
  'GET /api/v1/markets/:id': 'shared',
  'GET /api/v1/crypto/:symbol/price-history': 'shared',

  'GET /api/v1/wallet': 'player',
  'GET /api/v1/wallet/transactions': 'player',
  'GET /api/v1/wallet/requests': 'player',
  'POST /api/v1/wallet/requests': 'player',
  'POST /api/v1/bets': 'player',
  'GET /api/v1/bets': 'player',
  'GET /api/v1/bets/:id': 'player',
  'GET /api/v1/notifications': 'player',
  'POST /api/v1/notifications/:id/read': 'player',
  'POST /api/v1/notifications/read-all': 'player',

  'GET /api/v1/admin/dashboard': 'scopedAdmin',
  'GET /api/v1/admin/bets': 'scopedAdmin',
  'GET /api/v1/admin/wallet-requests': 'scopedAdmin',
  'POST /api/v1/admin/wallet-requests/:id/approve': 'scopedAdmin',
  'POST /api/v1/admin/wallet-requests/:id/reject': 'scopedAdmin',
  'GET /api/v1/admin/users': 'scopedAdmin',
  'POST /api/v1/admin/users': 'scopedAdmin',
  'GET /api/v1/admin/users/:id': 'scopedAdmin',
  'PATCH /api/v1/admin/users/:id': 'scopedAdmin',
  'POST /api/v1/admin/users/:id/block': 'scopedAdmin',
  'POST /api/v1/admin/users/:id/unblock': 'scopedAdmin',
  'POST /api/v1/admin/users/:id/reset-password': 'scopedAdmin',
  'DELETE /api/v1/admin/users/:id': 'scopedAdmin',

  'GET /api/v1/admin/clients': 'superAdmin',
  'POST /api/v1/admin/clients': 'superAdmin',
  'GET /api/v1/admin/clients/:id': 'superAdmin',
  'PATCH /api/v1/admin/clients/:id': 'superAdmin',
  'POST /api/v1/admin/clients/:id/deactivate': 'superAdmin',
  'POST /api/v1/admin/clients/:id/reactivate': 'superAdmin',
  'DELETE /api/v1/admin/clients/:id': 'superAdmin',
  'POST /api/v1/admin/markets/:id/settle': 'superAdmin',
};

const concrete = (key: string) => {
  const [method, path] = key.split(' ');
  return { method: method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete', path: path.replace(/:\w+/g, '999999') };
};

async function actors() {
  const player = await createUser({ role: 'CLIENT_USER' });
  const clientAdmin = await createUser({ role: 'CLIENT_ADMIN', clientId: player.clientId });
  const superAdmin = await createUser({ role: 'SUPER_ADMIN' });
  return {
    anon: {} as Record<string, string>,
    // What login really hands out:
    CU: sessionFor(player.id, 'mobile'),
    CA: sessionFor(clientAdmin.id, 'admin'),
    SA: sessionFor(superAdmin.id, 'admin'),
    // Genuinely signed tokens that claim the *wrong* app — login never issues these,
    // but if one ever existed the role guard must still hold.
    CU_asAdminApp: sessionFor(player.id, 'admin'),
    CA_asMobileApp: sessionFor(clientAdmin.id, 'mobile'),
    SA_asMobileApp: sessionFor(superAdmin.id, 'mobile'),
  };
}
type ActorName = keyof Awaited<ReturnType<typeof actors>>;

type Expected = 'allowed' | 401 | 403;

const EXPECTATIONS: Record<Exclude<Access, 'public'>, Record<ActorName, Expected>> = {
  anyAuth: { anon: 401, CU: 'allowed', CA: 'allowed', SA: 'allowed', CU_asAdminApp: 'allowed', CA_asMobileApp: 'allowed', SA_asMobileApp: 'allowed' },
  shared: { anon: 401, CU: 'allowed', CA: 'allowed', SA: 'allowed', CU_asAdminApp: 'allowed', CA_asMobileApp: 'allowed', SA_asMobileApp: 'allowed' },
  player: { anon: 401, CU: 'allowed', CA: 401, SA: 401, CU_asAdminApp: 401, CA_asMobileApp: 403, SA_asMobileApp: 403 },
  scopedAdmin: { anon: 401, CU: 401, CA: 'allowed', SA: 'allowed', CU_asAdminApp: 403, CA_asMobileApp: 401, SA_asMobileApp: 401 },
  superAdmin: { anon: 401, CU: 401, CA: 403, SA: 'allowed', CU_asAdminApp: 403, CA_asMobileApp: 401, SA_asMobileApp: 401 },
};

const CODE_OF = { 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN' } as const;
const ADMIN_ACCESS: Access[] = ['scopedAdmin', 'superAdmin'];

describe('RB-04 — the matrix is complete', () => {
  it('lists exactly the routes the app serves (a new route needs an access decision)', () => {
    const served = listRoutes(app);
    const documented = Object.keys(MATRIX).sort();

    expect(served.filter((route) => !documented.includes(route)), 'routes with no matrix entry').toEqual([]);
    expect(documented.filter((route) => !served.includes(route)), 'matrix entries for routes that no longer exist').toEqual([]);
  });
});

describe('RB-01 — every endpoint × every kind of caller', () => {
  const guarded = Object.entries(MATRIX).filter(([, access]) => access !== 'public') as [string, Exclude<Access, 'public'>][];

  it.each(guarded)('%s (%s)', async (route, access) => {
    const callers = await actors();
    const { method, path } = concrete(route);

    for (const [name, expected] of Object.entries(EXPECTATIONS[access]) as [ActorName, Expected][]) {
      const res = await api()[method](path).set(callers[name]).send({});
      const label = `${route} as ${name}`;
      if (expected === 'allowed') {
        expect([401, 403], label).not.toContain(res.status);
        expect(res.status, `${label} must not crash`).toBeLessThan(500);
      } else {
        expect(res.status, label).toBe(expected);
        expect(res.body.code, label).toBe(CODE_OF[expected]);
      }
    }
  });

  it('public routes need no session', async () => {
    expect((await api().get('/health')).status).toBe(200);
    expect((await api().post('/api/v1/auth/logout')).status).toBe(204);
    expect((await api().post('/api/v1/auth/login').send({})).status).toBe(400); // reached the handler, not blocked by auth
  });
});

describe('RB-02 / RB-03 / RB-CU — spot checks of the rules that matter most', () => {
  it('a Client Admin cannot settle markets or manage clients (SuperAdmin-only)', async () => {
    const { CA } = await actors();

    for (const [method, path] of [
      ['post', '/api/v1/admin/markets/1/settle'],
      ['get', '/api/v1/admin/clients'],
      ['post', '/api/v1/admin/clients'],
      ['delete', '/api/v1/admin/clients/1'],
    ] as const) {
      const res = await api()[method](path).set(CA).send({});
      expect(res.status, path).toBe(403);
    }
  });

  it('a Client Admin CAN reach the scoped admin endpoints (tenant filtering is checked in TN-*)', async () => {
    const { CA } = await actors();

    for (const [route, access] of Object.entries(MATRIX)) {
      if (access !== 'scopedAdmin') continue;
      const { method, path } = concrete(route);
      const res = await api()[method](path).set(CA).send({});
      expect([401, 403], route).not.toContain(res.status);
    }
  });

  it('a player cannot reach any /admin route, with any kind of session they could hold', async () => {
    const { CU, CU_asAdminApp } = await actors();

    for (const [route, access] of Object.entries(MATRIX)) {
      if (!ADMIN_ACCESS.includes(access)) continue;
      const { method, path } = concrete(route);
      for (const headers of [CU, CU_asAdminApp]) {
        const res = await api()[method](path).set(headers).send({});
        expect([401, 403], route).toContain(res.status);
      }
    }
  });

  it('staff cannot place bets or use a wallet', async () => {
    const { CA_asMobileApp, SA_asMobileApp } = await actors();

    for (const headers of [CA_asMobileApp, SA_asMobileApp]) {
      expect((await api().post('/api/v1/bets').set(headers).send({})).status).toBe(403);
      expect((await api().get('/api/v1/wallet').set(headers)).status).toBe(403);
      expect((await api().post('/api/v1/wallet/requests').set(headers).send({})).status).toBe(403);
    }
  });
});

describe('AUTH-08 (sweep) — a pending temporary password locks every endpoint except the /auth ones', () => {
  it('for players and for staff of both admin roles, across the whole matrix', async () => {
    const player = await createUser({ role: 'CLIENT_USER', mustChangePassword: 1 });
    const clientAdmin = await createUser({ role: 'CLIENT_ADMIN', mustChangePassword: 1 });
    const superAdmin = await createUser({ role: 'SUPER_ADMIN', mustChangePassword: 1 });
    const sessions = {
      CLIENT_USER: sessionFor(player.id, 'mobile'),
      CLIENT_ADMIN: sessionFor(clientAdmin.id, 'admin'),
      SUPER_ADMIN: sessionFor(superAdmin.id, 'admin'),
    };

    for (const [route, access] of Object.entries(MATRIX)) {
      if (access === 'public') continue;
      const { method, path } = concrete(route);
      const fits: (keyof typeof sessions)[] =
        access === 'superAdmin'
          ? ['SUPER_ADMIN']
          : access === 'player'
            ? ['CLIENT_USER']
            : access === 'scopedAdmin'
              ? ['SUPER_ADMIN', 'CLIENT_ADMIN']
              : ['CLIENT_USER', 'SUPER_ADMIN'];

      for (const who of fits) {
        const res = await api()[method](path).set(sessions[who]).send({});
        const label = `${route} as ${who}`;
        if (access === 'anyAuth') {
          expect([401, 403], label).not.toContain(res.status);
        } else {
          expect(res.status, label).toBe(403);
          expect(res.body.code, label).toBe('PASSWORD_CHANGE_REQUIRED');
        }
      }
    }
  });
});
