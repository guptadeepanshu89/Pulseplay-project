# PulsePlay

A multi-event, real-time prediction/market mobile app — cricket, football, crypto price movement, and elections — built with Expo (React Native) and TypeScript, backed by a real Node.js/Express/PostgreSQL API (`server/`), with a React admin panel (`admin/`) for running it: clients, players, fund-request approvals, bets, and market settlement.

**PulsePlay uses virtual currency only.** There is no payment gateway, no cash-out, and no real money involved anywhere in the app. Wallet balance changes go through admin-approved requests, tracked in Postgres.

The project is three pieces, all backed by the same API: the Expo mobile app (`src/`) that players use, the backend (`server/`), and the admin panel (`admin/`) that a SuperAdmin or a Client's own admin uses to run it. The mobile app and the admin panel don't need to run together — only whichever one you're working on needs the backend up. Crypto prices are genuinely live (CoinGecko); cricket/football fixtures are synced from TheSportsDB with a backend-simulated live-odds ticker on top; elections are seeded/static.

---

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Expo (managed workflow), SDK 57 |
| Language | TypeScript, `strict: true` |
| State management | React Context + `useReducer` (no Redux) |
| Navigation | React Navigation (native-stack + bottom-tabs) |
| Styling | `StyleSheet.create` + a hand-rolled design-token theme (`src/theme/`) — no styling library |
| Icons | `@expo/vector-icons` (bundled with Expo) |
| Charts | `react-native-svg` (custom line chart, no charting library) |
| Light/Dark mode | Full theming via `ThemeContext`, follows system by default, manually overridable in Profile |

No state library, UI kit, form library, or styling library beyond the above — kept intentionally minimal.

### Backend & admin panel

| Concern | `server/` | `admin/` |
|---|---|---|
| Framework | Node.js, Express 4, TypeScript `strict: true` | React 19 + TypeScript (Vite) |
| Data | PostgreSQL via Prisma (raw SQL for read-side reporting views) | — |
| Validation | Zod (`.strict()` schemas — unknown keys are a 400, not silently dropped) | Ant Design `Form` rules |
| UI / data fetching | — | Ant Design (components) + TanStack Query (server state, caching) |
| Routing | Express routers, one per module | React Router |
| Auth | JWT in an httpOnly cookie (admin app) or `Authorization: Bearer` (mobile), re-checked against the DB on every request | cookie only — never touches the token |
| Tests | Vitest + Supertest against a real, isolated Postgres schema | — (not yet added, see `docs/rbac-multi-tenancy-plan.md`) |

---

## Prerequisites

- [Node.js](https://nodejs.org/) LTS
- npm (ships with Node)
- [PostgreSQL 16](https://www.postgresql.org/) running locally (`winget install PostgreSQL.PostgreSQL.16` on Windows), with a `pulseplay` database and user matching `server/.env`
- For a native run: the [Expo Go](https://expo.dev/go) app on a physical Android/iOS device, **or** Android Studio (SDK + an AVD) for an emulator

## Setup

```bash
npm install              # mobile app, from the repo root
cd server && npm install # backend, from server/
```

The backend needs `server/.env` (copy `server/.env.example`; already present in this repo for local dev). Variables: `DATABASE_URL`, `JWT_SECRET` (required), `PORT` (default 4000), `BCRYPT_COST` (optional, default 10). There is no shared admin token any more — every admin is a real user who signs in (see Roles below). Then create the schema and seed demo data (first time only, or after a schema change):

```bash
cd server
npx prisma migrate deploy   # applies migrations to the DB (use `migrate dev` only when authoring a new one)
npx tsx src/seed.ts         # seeds a demo client + users, events, markets, bets, wallet, notifications
```

For a real deployment, create the first SuperAdmin with the CLI instead of relying on the demo seed (it prints a one-time password that must be changed at first sign-in):

```bash
cd server
npm run create-superadmin -- --name "Full Name" --email you@example.com --mobile 9876543210
```

### Roles and tenants

PulsePlay is multi-tenant. A **Client** is an organisation (a "tenant"); every user except a SuperAdmin belongs to exactly one.

| Role | Signs in through | Scope |
|---|---|---|
| `SUPER_ADMIN` | admin panel | everything; belongs to no client; created only by the CLI above |
| `CLIENT_ADMIN` | admin panel | runs one client; sees and manages only that client's users and requests |
| `CLIENT_USER` | mobile app | a player of one client; bets, wallet, fund requests |

Sign-in takes an `app` (`mobile` or `admin`); a role signing in through the wrong app gets `403 WRONG_APP`. Sessions are re-checked against the database on every request, so blocking or deleting a user, deactivating a client, or changing a password takes effect immediately. Users created by an admin get a generated temporary password and must change it at first sign-in. The full design, permission matrix and test catalogue are in [`docs/rbac-multi-tenancy-plan.md`](docs/rbac-multi-tenancy-plan.md).

---

## Running everything

Three terminals, all left running:

**Terminal 1 — backend API** (from `server/`):

```bash
cd server
npm run dev
```

Starts Express on `http://localhost:4000` (auto-restarts on file changes) and boots the live-data workers in-process: the crypto price feed (CoinGecko), the sports fixture sync (TheSportsDB), and the simulated live-odds ticker.

**Terminal 2 — mobile app** (from the repo root):

```bash
npm start        # Expo dev server — press w / a / i to open web / Android / iOS
npm run web       # opens directly in a browser
npm run android   # opens on a connected Android device/emulator
npm run ios       # opens on iOS simulator (macOS only)
```

On first run against a device/emulator, Expo Go is installed automatically if it isn't already present. The mobile app expects the backend to already be reachable — start Terminal 1 first.

`src/api/client.ts` already points web at `localhost:4000` and native at a LAN IP (e.g. `http://192.168.1.6:4000/api/v1`) — a physical device/emulator can't resolve your PC's `localhost` to itself, so it needs the LAN IP; the web preview needs `localhost` instead so the browser treats it as same-site with the API (required for the httpOnly auth cookie to work — see Security below). If your PC's LAN IP changes, update `LAN_API_BASE_URL` in that file.

**Terminal 3 — admin panel** (from `admin/`):

```bash
cd admin
npm install   # first time only
npm run dev
```

Opens on `http://localhost:5173` (Vite prints the exact URL). It talks to the backend at `http://localhost:4000/api/v1` (override with `VITE_API_BASE_URL` in `admin/.env.development`) — a different **port** but the same **site** (`localhost`) as the API, which is what lets the httpOnly `pulseplay_admin_token` cookie work without a proxy. Sign in with a `CLIENT_ADMIN` or `SUPER_ADMIN` login from the table below; a `CLIENT_USER` gets a clear "use the mobile app" message instead of a login.

### Admin panel

React 19 + TypeScript (Vite), Ant Design for the UI, TanStack Query for data fetching/caching, React Router for navigation. Everything the API exposes is reachable from it:

| Screen | Who | What |
|---|---|---|
| Dashboard | SA, CA | active players/clients, pending fund requests, open bets/stake — scoped to the signed-in Client Admin's own client, or filterable by client for a SuperAdmin |
| Users | SA, CA | create/edit/block/unblock/reset-password/delete; a SuperAdmin also picks the client and role (Player or Client Admin) |
| Fund Requests | SA, CA | filter by status, approve/reject — the wallet updates immediately, visible on the player's own app on its next poll |
| Bets | SA, CA | read-only, per-client (or platform-wide for a SuperAdmin) |
| Clients | SA only | create a Client together with its first Client Admin, rename, (de)activate, delete |
| Markets | SA only | settle an open market by picking the winning selection |

A temporary password (creating a user/client-admin, or resetting one) is shown exactly once in a dismissable dialog with a copy button — the server never returns it again. Signing in with one forces a change-password screen before anything else in the panel is reachable, mirroring the server-side `PASSWORD_CHANGE_REQUIRED` gate.

```bash
cd admin
npm run build   # type-checks (tsc -b) and produces dist/ for a static-hosting deploy
npm run lint
```

### Demo login

Auth is real — the backend checks a bcrypt-hashed password in Postgres. Seeded demo logins (dev only):

| Role | Email | Password | Where |
|---|---|---|---|
| Player (`CLIENT_USER`) | `rohan.kumar@example.com` (or mobile) | `password123` | mobile app |
| Client Admin (`CLIENT_ADMIN`) | `client.admin@example.com` | `DemoAdmin123` | admin panel |
| SuperAdmin (`SUPER_ADMIN`) | `admin@pulseplay.local` | `DemoAdmin123` | admin panel |

### Session storage / token security

The JWT is stored differently per platform, chosen around where each one is actually vulnerable:

- **Native**: kept in `expo-secure-store` (iOS Keychain / Android Keystore) and sent as an `Authorization: Bearer` header. Native has no script-injection surface the way a web page does, so this is standard practice.
- **Web**: the token is never held in `localStorage`/JS at all — any XSS on the page would be able to read it there. Instead, `POST /auth/login` sets it as an **httpOnly cookie**, invisible to page JS, which the browser attaches automatically. `GET/POST` requests from web send no `Authorization` header and rely purely on the cookie (`credentials: 'include'`).
- Logging out on web calls `POST /auth/logout` so the server can clear the cookie — client-side JS can't delete an httpOnly cookie itself.

This is why web and native use different base URLs (previous section): the cookie is `SameSite=Lax`, which requires the API and the page to be **same-site** (same host) — pointing the web build at a LAN IP instead of `localhost` would make it cross-site and the browser would silently drop the cookie.

### Running on a Windows Android emulator

If `emulator -accel-check` reports the hypervisor driver is missing, enable Windows Hypervisor Platform (WHPX) once, as Administrator, then restart:

```powershell
dism.exe /Online /Enable-Feature /FeatureName:HypervisorPlatform /All /NoRestart
```

This enables just the WHPX driver (lighter than turning on full Hyper-V) and is a one-time machine setup step, not a per-project one.

---

## Opening the database in a UI

[Prisma Studio](https://www.prisma.io/studio) is the built-in DB browser — no separate install needed. From `server/`:

```bash
cd server
npx prisma studio
```

Opens `http://localhost:5555` in your browser: browse/edit every table (User, Event, Market, MarketSelection, Bet, Wallet, WalletTransaction, WalletRequest, Notification, PriceHistory), with relations clickable. Useful for poking at data directly during dev — e.g. changing a `Market.status` to see the app react live, or checking `WalletLedger` for the audit trail of a bet.

(If you'd rather use a general Postgres client — pgAdmin, DBeaver, the VS Code PostgreSQL extension, `psql` — connect with the same `DATABASE_URL` from `server/.env`.)

---

## Project structure

```
src/
├── screens/       # one folder per feature area (home, markets, wallet, bets, profile, ...)
├── components/
│   ├── common/    # shared primitives: AppButton, Card, IconBadge, NavRow, Skeleton, ...
│   ├── market/    # market/event cards, odds buttons
│   ├── wallet/    # balance card, transaction/request rows
│   └── bet/       # bet slip items, bet summary rows
├── navigation/    # RootNavigator (stack) + BottomTabNavigator, typed param lists
├── context/       # AuthContext, WalletContext, BetSlipContext, NotificationContext, ThemeContext
├── theme/         # colors (light/dark), spacing, radius, typography, elevation
├── constants/     # layout/animation constants (no magic numbers in components)
├── types/         # domain types: event, market, bet, wallet, notification, user, crypto
├── api/           # client.ts — fetch wrapper, attaches the auth token, throws ApiError
├── services/      # one function per API call (auth/event/market/bet/wallet/notification/crypto)
├── hooks/         # shared hooks (e.g. useLoadOnMount)
└── utils/         # formatting/validation helpers

server/
├── prisma/
│   ├── schema.prisma    # data model (all IDs are auto-increment Int)
│   └── migrations/
├── src/
│   ├── index.ts          # Express app entry, starts the live-data workers
│   ├── db.ts              # Prisma client singleton
│   ├── env.ts              # loads/validates required env vars
│   ├── app.ts              # createApp(): the Express app without listen()/workers, so tests can drive it
│   ├── core/               # authentication/authorization primitives, no business rules:
│   │   ├── tokens.ts, actor.ts, password.ts, errors.ts, tenant.ts, ids.ts, pagination.ts, validation.ts
│   │   ├── middleware/    # authenticate, requireRole, validateBody, loginRateLimit
│   │   └── policies/      # can(action, actor, target) — the permission matrix as pure functions; assert.ts wraps it as a 403
│   ├── modules/            # one folder per feature, each schemas.ts · dto.ts · service.ts · routes.ts:
│   │   ├── auth/           # login, me, change-password
│   │   ├── clients/        # SuperAdmin-only: create/list/rename/(de)activate/delete a tenant
│   │   ├── users/          # scoped CRUD + block/reset-password/delete; accounts.ts has the logic clients/ reuses
│   │   │                     for its first Client Admin; superAdmin.ts backs the create-superadmin script
│   │   ├── fundRequests/   # create (player) / list / approve / reject (scoped) — the pending cap and the
│   │   │                     DECREASE insufficient-funds guard both live here
│   │   ├── dashboard/      # scoped counts for the admin panel's landing page
│   │   ├── bets/           # admin-side read-only bet list, scoped
│   │   └── markets/        # settle (SuperAdmin only) — moved out of the old routes/admin.ts
│   ├── routes/             # what's left for the mobile app: events, markets, bets, wallet, notifications, crypto
│   ├── scripts/            # createSuperAdmin.ts (`npm run create-superadmin`)
│   ├── lib/                # asyncHandler, serialize, money, parseId, lookupCache, roleCache, lookupTypes, marketDto, betDto, walletDto
│   ├── workers/            # cryptoFeed.ts, sportsTicker.ts, fixturesSync.ts
│   └── seed.ts             # seeds the demo client + users + starting data (roles/lookups come from migrations)
├── tests/                # Vitest + Supertest against an isolated Postgres schema (`test`), rebuilt from the real migrations
└── .env

admin/                    # React admin panel (Vite + TS + Ant Design + TanStack Query) — see "Admin panel" above
├── src/
│   ├── api/               # one file per backend module, thin wrappers around a shared axios instance
│   ├── context/           # AuthContext — GET /auth/me on load, listens for a mid-session 401 to sign out
│   ├── components/        # AppLayout (nav), ProtectedRoute/SuperAdminRoute, TempPasswordModal
│   ├── pages/              # one per screen (Login, ChangePassword, Dashboard, Clients, Users, FundRequests, Bets, Markets)
│   └── types/             # DTO types mirroring server/src/modules/*/dto.ts
└── .env.development       # VITE_API_BASE_URL
```

### Data model notes

- **No fixed-vocabulary column stores a raw string.** Every status/category/type field (event category/status, market/bet/wallet status, wallet transaction/request type, notification type, ...) is an `Int` FK into a generic `Lookup` table, grouped by `LookupType` (e.g. type `EVENT_CATEGORY` holds lookups `CRICKET`/`FOOTBALL`/`CRYPTO`/`ELECTION`). `Lookup.code` matches the old enum value exactly, so the JSON the mobile app receives is unchanged — resolution happens server-side via an in-memory cache (`lib/lookupCache.ts`, loaded once at boot) rather than a DB join on every request. Genuine free text (names, reasons, messages) is untouched — normalizing that would lose data, not gain safety.
- **Reporting views** (`vw_events`, `vw_markets`, `vw_bets`, `vw_wallets`, `vw_wallet_transactions`, `vw_wallet_ledger`, `vw_wallet_requests`, `vw_notifications`, `vw_market_selections`) resolve every lookup FK back to its code/label, for browsing in `psql`/pgAdmin/Prisma Studio without hand-joining `Lookup` yourself. The API doesn't query them — they're read-only DB conveniences, defined as raw SQL in `prisma/migrations/*_add_reporting_views/migration.sql`.
- **Audit columns** (`createdAt`, `updatedAt`, `isDeleted`) are on true master/reference tables (`User`, `Event`, `Market`, `MarketSelection`, `Wallet`, `Lookup`, `LookupType`) only — never on append-only transaction/ledger tables (`WalletTransaction`, `WalletLedger`, `Bet`, `Notification`, `PriceHistory`), since soft-deleting a financial log entry would undermine the audit trail it exists to provide.
- **`Role` and `Client`** are their own tables. `User.roleId` says what a user is; `User.clientId` says which tenant they belong to (`NULL` only for `SUPER_ADMIN` — a DB trigger enforces that). `Bet.clientId` and `WalletRequest.clientId` are denormalised copies of the owner's client, so tenant-scoped lists and dashboards filter on an indexed column without joining `User`. `Client.isActive` (0/1) suspends a whole tenant; `isDeleted` is a soft delete.
- **`User.isActive` / `isDeleted`**: `isActive = 0` blocks a user (reversible), `isDeleted = 1` soft-deletes them. Both are checked at login and again on every authenticated request.
- **`Market.modifiedByUserId` / `MarketSelection.modifiedByUserId`**, `WalletRequest.resolvedByUserId` and the `createdByUserId` columns are FKs to `User` (an admin is an ordinary `User` row), set by admin actions (settle, approve/reject) and left null for the price-jitter workers — every action is attributed to the person who really did it.
- **`User.lastLoginIp` / `lastLoginAt`** are set on every successful `POST /auth/login` — last-known values only, not a login history log.

Path aliases (see `tsconfig.json`): `@/*`, `@theme`, `@components/*`, `@screens/*`, `@navigation/*`, `@context/*`, `@constants/*`, `@types/*`, `@services/*`, `@hooks/*`, `@utils/*`.

## Real-time updates

The API hosts one Socket.IO server on the same HTTP server and port as Express, at path `/socket.io`. Connections send the existing mobile or admin JWT as `auth.token`. The handshake is rejected without a valid token. Each user is joined only to `user:{theirId}`. `subscribe:user` for any other id is refused. Wallet, bet, and notification events are emitted only to that user room, and only after the database transaction commits. Market odds use `market:{marketId}` after an authenticated client subscribes. Those rooms carry public odds, not wallet balances or personal data. Every `update` payload includes `type`, `entityId`, `timestamp`, and a process-local `seq`.

The mobile client reconnects with a 1 second delay, backing off to 10 seconds. The header shows Live, Reconnecting, or Offline. A reconnect resets the local sequence and refetches the current screen from the REST API, because the server does not replay missed events. If a later `seq` skips numbers, the client also refetches. While the socket is disconnected, a focused foreground screen polls about every 8 seconds. The poll stops on reconnect, backgrounding, or unmount. Duplicate and older `seq` values are ignored.

`GET /health` and `GET /health/live` only prove the process is up. Point liveness probes there. `GET /health/ready` runs `SELECT 1` and returns 503 when the database is down. Worker and provider staleness is included in that body but does not by itself fail readiness, so a quiet cricket or crypto feed does not restart the API. `GET /metrics` returns plain counters. None of these responses include secrets. Restrict `/health/ready` and `/metrics` at the reverse proxy if the host is public. No external alerting vendor is configured.

One process is the supported deployment. `SOCKET_REDIS_URL` is not enough to scale out: the Redis adapter is not installed, and a set value is logged and ignored. Sticky sessions and a Redis adapter would be required before running more than one API instance. `SIGTERM` and `SIGINT` stop worker scheduling, close Socket.IO, and close the HTTP server.

The sports ticker still jitters stored football and cricket display scores and open selection prices. That data is synthetic. CricketData responses are the only cricket provider feed, and they are not used to settle bets. Crypto price history is written only from a verified Bybit or CoinGecko quote. Settlement is unchanged and does not run from a socket handler.

`GET /api/v1/demo/snapshot` and `POST /api/v1/demo/tick` are authenticated and in-memory. The tick emits `demo.updated` only to that user. Profile → Live demo shows it. The payload is marked `demo`, `synthetic`, and `settlesBets: false`.

```bash
# optional; otherwise the app uses EXPO_PUBLIC_API_URL with /api/v1 removed
# EXPO_PUBLIC_SOCKET_URL=http://localhost:4000
```

The admin dev server proxies `/socket.io` to `http://127.0.0.1:4000`. The admin UI still uses REST for its pages. No database migration is required for sockets, health checks, suspend/resume, or the settlement lock (`OPEN`, `SUSPENDED`, `CLOSED`, and `SETTLED` already exist).

Example snapshot:

```json
{ "demo": true, "synthetic": true, "settlesBets": false, "id": "demo-market", "version": 1, "price": 1.5 }
```

Example socket payload:

```json
{ "type": "demo.updated", "entityId": 0, "timestamp": "2026-10-17T12:00:00.000Z", "seq": 4, "data": { "demo": true, "synthetic": true, "version": 2, "price": 1.51 } }
```

Verified spot prices use the same `update` event with type `crypto.updated`. The pair is not a numeric market id, so `entityId` is `1` for BTCUSDT, `2` for ETHUSDT, and `3` for SOLUSDT, and `data.symbol` is the pair string. CricketData scores use `cricket.updated` with `entityId` `0` because match ids are UUIDs; the client matches `data.matchId`. These events do not change betting odds, wallets, or settlement. The sports ticker remains a separate synthetic feed.

Live-test checklist:

1. Sign in on the app and confirm the header says Live.
2. Open Profile → Live demo. The snapshot loads from `GET /api/v1/demo/snapshot`.
3. Press Publish demo update. The version increases from the socket event and a refresh still matches the API.
4. Stop the network. The header moves to Reconnecting, then Offline, and a focused market screen polls instead of spinning.
5. Restore the network. The header returns to Live and the screen refetches.
6. Restart the API. Clients disconnect, then reconnect and load the latest API snapshot. Missed ticks are not replayed.
7. `curl http://localhost:4000/health` stays 200 while the process is up. Stop PostgreSQL and `curl -i http://localhost:4000/health/ready` returns 503. Start PostgreSQL and it returns 200. Liveness stays 200 in both cases.

Market suspend and resume (Super Admin only):

- `POST /api/v1/admin/markets/:id/suspend`
- `POST /api/v1/admin/markets/:id/resume`

Settlement stays `POST /api/v1/admin/markets/:id/settle`. It locks the market row and the open bets in one transaction so a concurrent bet cannot be accepted and then left open. Fixture sync no longer marks a match completed because a time window elapsed; completion stays an administrator settlement action unless a stored terminal status (`COMPLETED`, `CANCELLED`, `POSTPONED`) is already set.

## Checks

```bash
# mobile app, from the repo root
npx tsc --noEmit                              # type-check
npx eslint "src/**/*.{ts,tsx}" "App.tsx"       # lint

# backend, from server/
cd server
npm run typecheck                             # type-check the server and its tests
npm test                                      # Vitest suite; needs the same Postgres as dev (uses its own `test` schema, never touches `public`)

# admin panel, from admin/
cd admin
npm run build                                 # tsc -b (type-check) + vite build
npm run lint                                  # oxlint
```
