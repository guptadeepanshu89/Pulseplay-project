# PulsePlay — Role-Based Access & Multi-Tenancy: Work Plan

Status: **IN PROGRESS** — P0 ✅ · P1 ✅ · P2 ✅ · P3 ✅ (backend) · P6 admin panel started, ahead of P4/P5. (Assumptions A1–A11 accepted as written; the user said "start", then asked for the admin panel before P4/P5 hardening — see deviations.)
Scope: backend (`server/`), mobile app touch-ups (`src/`), new React admin panel (`admin/`).

---

## Progress log

| Phase | State | Evidence |
|---|---|---|
| P0 Foundations | ✅ done | Vitest + Supertest against an isolated `test` Postgres schema rebuilt from the real migrations; characterization suite BT-01…BT-16 pins today's betting/wallet behaviour |
| P1 Schema | ✅ done | Migration `20260926150000_rbac_multi_tenancy` (Role, Client, User columns, tenant keys, actor FKs, views recreated, DB trigger). MG-01/01b/02/03/04/05/06/07/09/10 + TN-11 green; applied to the dev DB with a backup taken first |
| P2 AuthN/AuthZ | ✅ done | `core/` (tokens, actor, password, errors, `authenticate`, `requireRole`, `validateBody`, `loginRateLimit`, `policies`), `modules/auth`, every existing route guarded by role, `X-Admin-Token`/`ADMIN_USER_EMAIL` removed, `npm run create-superadmin`. POL-01…05 (incl. table-vs-code completeness), AUTH-01…20 (AUTH-08 as a sweep over every route), RB-01/02/03/04 + RB-CU, RC-01/02/04, CLI-01/02, SC-05 (partial) green |
| P3 Modules | ✅ done | `core/tenant.ts`, `core/ids.ts`, `core/pagination.ts`, `core/validation.ts`, `core/policies/assert.ts`; `modules/clients`, `modules/users` (+ shared `modules/users/accounts.ts`), `modules/fundRequests`, `modules/dashboard`, `modules/bets` (admin list), `modules/markets` (settle) — the old monolithic `routes/admin.ts` is gone. The DECREASE insufficient-funds defect is fixed (conditional debit, rolls the whole approval back), the 5-pending cap and `WALLET_REQUEST_RECEIVED` approver notification are live. CL-01…12, US-01…17, FR-04/06/10/12/13/14/16/17, TN-02/03/05/06/09/10 green (58 new tests); full suite 323/323, `tsc` clean |
| P6 Admin panel | 🔶 started | `admin/` scaffolded (Vite + React 19 + TS) — see deviation below for the library swap. Login, forced change-password, Dashboard, Clients (SA), Users (scoped create/edit/block/reset-password/delete with one-time temp-password modal), Fund Requests (approve/reject), Bets (read-only), Markets/Settle (SA) are wired to the real API and smoke-tested end to end against the dev DB (create client → temp-password login → forced change-password → create player → player deposits → Client Admin approves → dashboard and wallet update live). `tsc -b` and `vite build` clean. Not yet done: RTL/Vitest component tests, Playwright E2E (PN-*/E2E-*) |

**Deviations from the plan as written (all deliberate):**
- **Credential-version claim instead of `iat < passwordChangedAt`.** A JWT `iat` is whole seconds, so a token issued in the same second as a password change can't be told apart from one issued just after it. Tokens carry `pv` = the user's `passwordChangedAt` in epoch ms (0 if never changed); any mismatch → `401 TOKEN_REVOKED`. Exact, and needs no clock comparison (AUTH-10).
- **Wrong current password on change-password is `400 INVALID_CURRENT_PASSWORD`, not 401** (AUTH-09): a 401 makes the mobile client treat the session as expired and log the user out.
- **Admin routes reject a mobile token with 401, not 403**: the token isn't accepted by that app at all, so there is no identity to forbid. 403 `FORBIDDEN` is what a genuine token of the wrong *role* gets (RB-01 spells out both).
- **POL-05 / POL-06 re-cut.** The last-admin guard is a lifecycle rule and moves to P3 with the users module (US-*), listed as POL-06; the P2 POL-05 is "a client-bound actor with a NULL `clientId` never matches a target", and self-target is covered by the matrix rows (staff are never `CLIENT_USER`, so they can never target themselves).
- **AUTH-21** (PATCH cannot change `roleId`/`clientId`) needs the users module, so it is delivered with P3 (also SC-01).
- `User.email`/`mobile` stay globally unique even for soft-deleted rows, so freeing them on delete is done by PII anonymisation in P3 (US-*), not by relying on `isDeleted` filters.
- Role ids are cached **once at boot** (no periodic refresh) — roles are immutable reference data. RC-03 (refresh-failure handling) therefore no longer applies; boot still fails if any of the 3 roles is missing.
- `core/` primitives (errors, zod validate, pagination) are created in the phase that first uses them (P2/P3) rather than up front, to avoid dead code.
- The `SUPER_ADMIN ⇔ clientId IS NULL` invariant is enforced by a **DB trigger** (not just service code) — test MG-09.
- The migrated-with-data path is tested against a second scratch schema (`mg_backfill`): pre-RBAC migrations → legacy rows → RBAC migration → assertions → drift check.
- Legacy `X-Admin-Token` routes keep working through P1; they are removed in P2.
- **P6 pulled ahead of P4/P5** on explicit request ("admin panel bhi bnao jha se sab kuch handle ho"): the panel was built against the P3 API surface before the mobile-app touch-ups (P4) or the hardening pass (P5, incl. `helmet`, CSRF/content-type checks, audit log). Nothing in P4/P5 changes the API contracts the panel already relies on, so this is additive, not a rework risk.
- **Admin panel table/data library**: Ant Design's own `Table` is used instead of the plan's TanStack Table (D9) — with Ant Design already in use for every other component, a second table library bought no real benefit for CRUD-with-pagination screens and would have meant two sets of table styling to maintain. TanStack Query is used as planned.
- A **fetch-then-compare tenant check** (load the row, then compare `clientId` to the actor's scope, 404 on mismatch) is used for single-object admin lookups (users, fund requests) rather than baking the scope into every `WHERE` clause — chosen because the object is only ever returned to the caller after the check passes, so there is no leak, and it keeps `fetchScopedUser`/`fetchScoped` as the one place that decides "can this actor see this row at all".

---

## 1. Goal

Turn PulsePlay from a single-tenant app (one shared admin token, one flat user pool) into a multi-tenant platform:

- **SuperAdmin** (the platform owner) has all access.
- The owner hands the app to a **Client** (e.g. *Nitin*, *Ashok*). Each Client owns a private group of **Client Users**.
- A Client Admin approves fund requests **only for his own users**; the approval reflects in the user's wallet immediately.
- Everyone who logs in is a `User` row with a role. Users can be removed at any time (soft delete) without breaking financial history.
- A React **admin panel** drives all of this.

### Non-goals (explicitly out of scope)
White-label mobile builds/branding per client · client-owned markets/events · pool/float accounting (client balance that funds users) · real-time push (SSE/WebSocket) · 2FA/SSO · per-client custom permission sets.

---

## 2. Concepts

| Concept | Meaning |
|---|---|
| **Role** (table) | `SUPER_ADMIN`, `CLIENT_ADMIN`, `CLIENT_USER`. Immutable per user. |
| **Client** (table) | The tenant / organisation ("Nitin's group"). Not a person. Has `isActive` / `isDeleted`. |
| **Client Admin** | A `User` with role `CLIENT_ADMIN` who runs a Client (Nitin logs in as this). A Client may have several. |
| **Client User** | A `User` with role `CLIENT_USER` — the player who uses the mobile app. Only role that has a wallet. |
| **Tenant scope** | The rule `actor.clientId == target.clientId`; SuperAdmin is exempt. |

Hierarchy: `SuperAdmin → Client (org) → { Client Admin(s), Client Users }`.

---

## 3. Decision log

| # | Decision | Status |
|---|---|---|
| D1 | Separate `Role` and `Client` tables; `User` carries `roleId` + `clientId` | Confirmed |
| D2 | `Client.isActive` is a 0/1 int (no lookup status); `isDeleted` 0/1 int | Confirmed |
| D3 | Flags are integers 0/1, never booleans | Confirmed |
| D4 | Fund approval mints credit on approve (no client balance pool) | Assumed (recommended) |
| D5 | Markets/events stay global; only SuperAdmin settles | Assumed (recommended) |
| D6 | Client Admin (or SuperAdmin) creates Client Users in the panel; no self-signup | Assumed (recommended) |
| D7 | "Delete" = soft delete; history kept; PII anonymised; guards below | Assumed (recommended) |
| D8 | Wallet balance reflects via polling for now (foreground + every ~15 s on wallet screen) | Assumed |
| D9 | Admin panel: Vite + React + TS + Ant Design + TanStack Query/Table | Assumed |
| D10 | `X-Admin-Token` and `ADMIN_USER_EMAIL` are removed; admins log in like everyone | Confirmed by design |

### Assumptions to confirm before P1 (change here, plan adapts)
- **A1** A Client may have multiple `CLIENT_ADMIN`s; only SuperAdmin creates them (v1).
- **A2** Role code is named `CLIENT_ADMIN`.
- **A3** Both `User.isActive` (block/unblock) and `Client.isActive` are added.
- **A4** Roles are immutable; users cannot move between Clients (v1).
- **A5** `SUPER_ADMIN` accounts are created only by seed/CLI — never through the API.
- **A6** Admin-app JWT lives 8 h; mobile-app JWT stays 7 d.
- **A7** Temp passwords are server-generated (16 chars) and shown once; user must change at first login; new password ≥ 10 chars, letters + digits.
- **A8** Max 5 PENDING fund requests per user (anti-spam).
- **A9** Admin lists use offset pagination (`page`, `pageSize` ≤ 100) with `total`.
- **A10** Deleting a Client requires zero non-deleted Client Users and zero PENDING requests; its Client Admins are soft-deleted with it.
- **A11** Optional `AuditLog` table (who did what to whom) — decide at start of P5.

---

## 4. Findings in the current system (verified in code)

1. No tenancy: `WalletRequest` has no owner; `/admin/bets` and `/admin/wallet-requests` return everything.
2. Admin auth is one shared token → no identity; `resolvedBy`/`createdBy` are the literal string `'admin'`.
3. `User.isDeleted` exists but **no flow uses it** — login and `authMiddleware` never check it. `User.isActive` does not exist. A deleted user's 7-day JWT keeps working.
4. Soft delete would collide with `UNIQUE(email, mobile, userCode)`.
5. **Defect:** approving a `DECREASE` request does `availableBalance += -amount` with no balance guard → wallet can go negative.
6. Admin lists are unpaginated; request bodies are cast, not validated (no zod).
7. No automated tests exist. `LOOKUP_IDS` is untyped, so a typo in a role/lookup code fails at runtime, not compile time — authorization code must be test-covered.

---

## 5. Target architecture

### 5.1 Data model (Prisma sketch)

```prisma
model Role {
  id Int @id @default(autoincrement())
  code String @unique            // SUPER_ADMIN | CLIENT_ADMIN | CLIENT_USER
  name String
  isDeleted Int @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  users User[]
}

model Client {
  id Int @id @default(autoincrement())
  code String @unique
  name String
  isActive Int @default(1)
  isDeleted Int @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  createdByUserId Int?
  modifiedByUserId Int?
  users User[]
  walletRequests WalletRequest[]
  bets Bet[]
}

// User additions
roleId Int            // FK Role, NOT NULL
clientId Int?         // FK Client; NULL only for SUPER_ADMIN (enforced in service + tested; DB trigger optional)
isActive Int @default(1)
mustChangePassword Int @default(0)
passwordChangedAt DateTime?
createdByUserId Int?  // self-FK
modifiedByUserId Int? // self-FK
// isDeleted already exists

// Denormalised tenant key (immutable because users can't change client in v1)
WalletRequest.clientId Int   // NOT NULL, routing key
Bet.clientId Int             // NOT NULL, tenant-scoped bet lists without a join
// Actor FKs replacing the 'admin' strings
WalletRequest.resolvedBy  -> resolvedByUserId Int?
WalletTransaction.createdBy / WalletLedger.createdBy -> createdByUserId Int?
```

Indexes: `User(clientId, roleId, isDeleted)`, `WalletRequest(clientId, statusId, requestedAt DESC)`, `Bet(clientId, placedAt DESC)`, `User(email)`/`(mobile)` unique (existing).

Role ids are cached at boot like `LOOKUP_IDS` (`ROLE_IDS.CLIENT_ADMIN`); boot **fails** if any of the 3 required roles is missing (authorization must fail closed).

### 5.2 Code layout (layered; new code only — existing bet/market code is left alone)

```
server/src/
  core/
    errors.ts            AppError(status, code, message)  + central error handler
    actor.ts             type Actor { userId, roleCode, clientId|null, ... }
    middleware/authenticate.ts   cookie/bearer by "app" → loads Actor from DB
    middleware/requireRole.ts
    middleware/validate.ts       zod, .strict() (unknown keys → 400)
    pagination.ts
    tenant.ts            tenantWhere(actor) → Prisma where / Prisma.sql fragment
    policies/            PURE functions, no DB — exhaustively unit-tested
      userPolicy.ts  clientPolicy.ts  fundRequestPolicy.ts  marketPolicy.ts
  modules/
    auth/  clients/  users/  fundRequests/  dashboard/     (routes.ts · service.ts · schemas.ts)
```

- **Routes** = HTTP only. **Services** = business rules + transactions. **Policies** = "may actor do X to target?" as pure functions (so the permission matrix is a table-driven unit test).
- Errors: `{ "error": "<message>", "code": "<MACHINE_CODE>" }` — keeps `error` as a string so the mobile `ApiError` parsing is unchanged.
- Semantics: **401** not authenticated · **403** authenticated but role/state forbids the endpoint · **404** object outside your tenant (never leak existence) · **409** state conflict · **400** validation.

### 5.3 Auth & request pipeline

`authenticate → (mustChangePassword gate) → requireRole → validate(zod) → handler → service`

- JWT carries only `sub`, `iat`, `exp`, `app` (`mobile`|`admin`). **Nothing else is trusted.**
- On **every** request one indexed PK query loads: user (`isDeleted`, `isActive`, `roleId`, `clientId`, `mustChangePassword`, `passwordChangedAt`) + client (`isActive`, `isDeleted`). Deleted/blocked user, inactive/deleted client, or `iat < passwordChangedAt` → rejected immediately. (Optional 5 s LRU cache only if metrics demand; trade-off = revocation delay.)
- Two cookies: `pulseplay_token` (mobile web) and `pulseplay_admin_token` (panel). Cookies are not port-scoped on `localhost`, so separate names stop the panel and mobile-web sessions overwriting each other; each route group reads only its own cookie.
- `/auth/login` takes `app`. Admin app accepts only `SUPER_ADMIN`/`CLIENT_ADMIN`; mobile app accepts only `CLIENT_USER` (`403 WRONG_APP` otherwise).
- Login: uniform error + constant-time behaviour for unknown user vs wrong password; account-state errors (`ACCOUNT_BLOCKED`, `CLIENT_INACTIVE`) revealed **only after** the password is verified. Rate limit on login (per IP + per identifier).

### 5.4 Permission matrix (single source of truth → policy tests)

| Action | SUPER_ADMIN | CLIENT_ADMIN | CLIENT_USER |
|---|---|---|---|
| Create / edit / (de)activate / delete Client | ✔ | – | – |
| Create / delete Client Admin | ✔ | – | – |
| Create / edit / block / reset-password / delete Client User | ✔ any | ✔ own client | – |
| List / view users | all (filter by client) | own client | self only (`/auth/me`) |
| List / approve / reject fund requests | ✔ any | ✔ own client | – |
| Create fund request, view own requests | – | – | ✔ |
| View bets / transactions / dashboard | all | own client | own only |
| Place bet, view wallet | – | – | ✔ |
| Settle markets, manage events | ✔ | – | – |

### 5.5 Fund-request flow (state machine `PENDING → APPROVED | REJECTED`, terminal)

1. Client User `POST /wallet/requests` → server sets `clientId = user.clientId` (body value rejected), enforces amount/reason limits and the 5-pending cap. Approvers get a `WALLET_REQUEST_RECEIVED` notification.
2. Approver (own-client `CLIENT_ADMIN` or `SUPER_ADMIN`) `POST /admin/wallet-requests/:id/approve` — **one DB transaction**:
   conditional claim `WHERE id AND clientId(scope) AND status=PENDING` → verify requester still active → wallet update (for DECREASE: conditional `availableBalance >= amount`, else `409 INSUFFICIENT_FUNDS`) → `WalletTransaction` + `WalletLedger` (`createdByUserId = actor`) → user notification.
3. Balance is committed atomically, so `GET /wallet` shows it instantly; the app picks it up via polling (D8).

### 5.6 Lifecycle rules

- **Create Client** (SuperAdmin): `Client` + first `CLIENT_ADMIN` in **one transaction**; server-generated temp password returned once; `mustChangePassword=1`.
- **Create Client User**: `clientId` taken from the actor's session (SuperAdmin passes it explicitly); creates the `Wallet` (ACTIVE, 0/0) in the same transaction.
- **Block** (`isActive=0`): reversible; funds untouched; access cut on next request. Blocking the last active `CLIENT_ADMIN` of a client → `409 LAST_ADMIN`.
- **Delete user** (soft): blocked with `409` if wallet available/locked ≠ 0, any OPEN bet, or any PENDING request. On success: `isDeleted=1, isActive=0`, `email → deleted+{id}@invalid.local`, `mobile → del-{id}`, `userCode → DEL-{id}`, `name → "Deleted User"`, password hash invalidated. Bets/ledger rows stay intact.
- **Deactivate Client**: all its users/admins lose access immediately; pending requests stay PENDING (only SuperAdmin can resolve). **Delete Client**: per A10; `code` anonymised.
- Roles and `clientId` are not editable after creation.

### 5.7 API surface (`/api/v1`)

| Endpoint | SA | CA | CU |
|---|---|---|---|
| `POST /auth/login` (`app`), `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password` | ✔ | ✔ | ✔ |
| `GET/POST /admin/clients`, `GET/PATCH/DELETE /admin/clients/:id` | ✔ | – | – |
| `GET/POST /admin/users`, `GET/PATCH/DELETE /admin/users/:id`, `POST …/:id/block`, `…/unblock`, `…/reset-password` | ✔ | scoped | – |
| `GET /admin/wallet-requests`, `POST …/:id/approve`, `…/:id/reject` | ✔ | scoped | – |
| `GET /admin/bets`, `GET /admin/wallet-transactions`, `GET /admin/dashboard` | ✔ | scoped | – |
| `GET /admin/markets`, `POST /admin/markets/:id/settle` | ✔ | – | – |
| existing `/wallet`, `/wallet/requests`, `/bets`, `/notifications`, `/events`, `/markets`, `/crypto` | – | – | ✔ (events/markets/crypto read: all roles) |

List contract: `?page=1&pageSize=25&search=&sort=&…` → `{ items, page, pageSize, total }`; `sort` is allow-listed; `pageSize > 100` → `400`.

### 5.8 Migration plan (hand-written SQL; `migrate dev` can't run non-interactively and would drop/recreate columns)

| Step | Content |
|---|---|
| M1 | Create `Role`, `Client`; insert 3 roles and a **Demo Client** (set `"updatedAt"` explicitly — raw INSERTs bypass Prisma's `@updatedAt`) |
| M2 | Add `User` columns (nullable) → backfill (`admin@pulseplay.local` → SUPER_ADMIN, `clientId` NULL; everyone else → CLIENT_USER of Demo Client) → set `roleId` NOT NULL, add FKs/indexes |
| M3 | `WalletRequest.clientId`, `Bet.clientId` add + backfill from `User.clientId` → NOT NULL |
| M4 | `resolvedBy`/`createdBy` strings → `…UserId` FKs (`'admin'` → SuperAdmin id); drop old columns |
| M5 | Drop & recreate every `vw_*` view whose base table changed (`SELECT alias.*` is expanded at creation; Postgres refuses to alter a column a view uses) |
| Check | `prisma migrate diff --from-url … --to-schema-datamodel …` must be empty; row counts before/after equal |
| Rollback | `pg_dump` before running; restore on failure (forward-only migrations) |

### 5.9 Security checklist (each maps to tests in §7)
No client-supplied `clientId`/`roleId`/`isDeleted`/`isActive` ever trusted (zod `.strict()`) · every `:id` query carries the tenant predicate in the *same* query (IDOR) · raw-SQL view helpers (`fetch*`) must include the tenant predicate · `Content-Type: application/json` required on mutations (CSRF with `SameSite=Lax`) · `helmet`, login rate-limit, no secrets/hashes in responses or logs · temp-password entropy · CORS allow-list for the panel origin.

### 5.10 Scale notes
Per-request actor load is a PK lookup; tenant lists hit composite indexes; offset pagination is fine per tenant, SuperAdmin global lists must be filtered (or move to keyset if needed); bcrypt cost makes login CPU-bound — rate-limit and size accordingly; connection pool sized for admin-panel bursts.

---

## 6. Phases

| Phase | Deliverable | Size | Exit criteria |
|---|---|---|---|
| **P0** Foundations | Test harness (Vitest + Supertest, isolated Postgres **schema** `?schema=test` — app role can create/drop schemas), factories, `core/` primitives (errors, zod validate, pagination, error handler), **characterization tests of today's behaviour** (BT-*) | M | Baseline suite green on current code |
| **P1** Schema | M1–M5 + seed changes + role cache | M | MG-* green, drift empty |
| **P2** AuthN/AuthZ | authenticate, requireRole, policies, login/app split, change-password, rate-limit, remove admin token | L | AUTH-*, RB-*, RC-*, POL-* green |
| **P3** Modules | clients, users, fund requests (incl. DECREASE fix), dashboard, notifications, scoped+paginated lists | L | CL-*, US-*, FR-*, TN-*, API-*, CC-* green |
| **P4** Existing routes | Role/active checks on bets/wallet; settle = SuperAdmin; mobile tweaks | S–M | BT-*, MB-* green |
| **P5** Hardening | helmet, audit log (if A11), perf seed + EXPLAIN, security sweep | M | PF-*, SC-* green |
| **P6** Admin panel | A1 shell/login/change-password · A2 users · A3 fund-request queue · A4 clients · A5 bets/transactions/dashboard · A6 markets/settle + audit | L | PN-*, E2E-* green |
| **P7** Docs | README, runbook (create client, reseed, rollback), env vars | S | Fresh clone → working system |

Each phase ends with: `tsc` clean · all listed test IDs green · migration drift empty · README updated.

---

## 7. Test plan

Layers: **[U]** unit (pure policies) · **[I]** integration (Supertest → real Postgres test schema) · **[M]** migration/SQL · **[E]** end-to-end (Playwright) · **[C]** component (React Testing Library).
Fixture world (factories): `SA`; Client **A** (admin `A_ADM`, users `A_U1`, `A_U2`); Client **B** (admin `B_ADM`, users `B_U1`, `B_U2`); each user has a wallet, a bet and a pending request; one open market with 3 selections.

### 7.0 Characterization (baseline before any change) — BT
| ID | L | Scenario | Expected |
|---|---|---|---|
| BT-01 | I | Place single bet with sufficient funds | 201, `OPEN`, available−stake, locked+stake, ledger+txn+notification |
| BT-02 | I | Stake > available | 400, wallet unchanged |
| BT-03 | I | Market not OPEN / unknown market / selection not in market | 409 / 404 / 404 |
| BT-04 | I | Client-sent price ignored; server price used | `combinedOdds` from DB |
| BT-05 | I | 20 parallel bets, funds for 5 | exactly 5 succeed, balance never negative |
| BT-06 | I | Settle market: winner / loser math (`potentialReturn` floor to 2 dp) | wallet, ledger, status WON/LOST, notification exact |
| BT-07 | I | Settle twice | 409, no double credit |
| BT-08 | I | Bets on same market from tenants A and B | each settled and credited to own wallet |
| BT-09 | I | Multi-leg bet on settled market | stays OPEN (documented cut) |
| BT-10 | I | Settle sets `modifiedByUserId` = acting SuperAdmin | correct id |

### 7.1 Policy matrix — POL [U]
Table-driven: every cell of §5.4 × relation (`self`, `same-client`, `other-client`, `none`) → expected boolean. CI fails if an action exists in code without a matrix row.
| ID | Scenario |
|---|---|
| POL-01 | Each (role × action × relation) cell of §5.4 |
| POL-02 | `SUPER_ADMIN` allowed everywhere; `CLIENT_USER` denied every admin action |
| POL-03 | `CLIENT_ADMIN` denied any `other-client` target, allowed `same-client` where matrix says so |
| POL-04 | Unknown role / undefined role id → **deny** (fail closed) |
| POL-05 | Client-bound actor with NULL `clientId` never matches a target (no `null === null` leak) |
| POL-06 | Last-admin guard (moved to P3, see US-*) |

### 7.2 Authentication — AUTH
| ID | L | Scenario | Expected |
|---|---|---|---|
| AUTH-01 | I | `CLIENT_USER` logs in with `app=mobile` (email / mobile / mixed-case email / padded) | 200, token+cookie, DTO has role code |
| AUTH-02 | I | `SUPER_ADMIN`, `CLIENT_ADMIN` log in with `app=admin` | 200, `pulseplay_admin_token` cookie, 8 h expiry |
| AUTH-03 | I | `CLIENT_USER` with `app=admin`; admins with `app=mobile` | 403 `WRONG_APP` |
| AUTH-04 | I | Wrong password vs unknown identifier | identical 401 body; timing within tolerance |
| AUTH-05 | I | Blocked user, correct password | 403 `ACCOUNT_BLOCKED`; wrong password → 401 (no state leak) |
| AUTH-06 | I | Soft-deleted user | 401 generic |
| AUTH-07 | I | User of inactive / deleted Client | 403 `CLIENT_INACTIVE` / 401 |
| AUTH-08 | I | Login with `mustChangePassword=1` | 200 + flag; every endpoint except `change-password`, `me`, `logout` → 403 `PASSWORD_CHANGE_REQUIRED` |
| AUTH-09 | I | Change password: wrong current / weak / same-as-old / success | 400 `INVALID_CURRENT_PASSWORD` / 400 / 400 / 200 flag cleared, `passwordChangedAt` set |
| AUTH-10 | I | Token issued before password change | 401 |
| AUTH-11 | I | Expired token; tampered signature; `alg=none`; malformed | 401 each |
| AUTH-12 | I | User deleted **after** token issued | next request 401 immediately |
| AUTH-13 | I | User blocked after token issued → unblocked | 403 immediately → works again |
| AUTH-14 | I | Client deactivated after tokens issued → reactivated | all its users/admins rejected → restored |
| AUTH-15 | I | Mobile cookie sent to admin route and vice-versa | 401 |
| AUTH-16 | I | Old `X-Admin-Token` header on any route | 401 (feature removed) |
| AUTH-17 | I | Brute force: N bad logins per IP / per identifier | 429 + `Retry-After`; success not counted; window resets |
| AUTH-18 | I | Responses never contain `passwordHash`, internal flags | asserted on every auth DTO |
| AUTH-19 | I | `lastLoginIp/At` updated only on success | asserted |
| AUTH-20 | I | Logout clears cookie (204) | cookie removed |
| AUTH-21 | I | PATCH attempting to change `roleId`/`clientId` | 400 (roles immutable) |

### 7.3 Role × endpoint matrix — RB [I]
Generated from the same table as §5.7. For **every** endpoint: no auth → **401**; `CLIENT_USER` (on admin routes) → **403**; `CLIENT_ADMIN` → allowed or **403** exactly as tabled; `SUPER_ADMIN` → allowed. Also `RB-CU`: SA/CA on `/bets`, `/wallet`, `/wallet/requests` (POST) → 403.
| ID | Scenario |
|---|---|
| RB-01 | Full matrix sweep (endpoints × roles × unauth) |
| RB-02 | `CLIENT_ADMIN` on `/admin/clients*`, `/admin/markets/*/settle` → 403 |
| RB-03 | `CLIENT_USER` on every `/admin/*` → 403 |
| RB-04 | Adding a route without a matrix entry fails the suite |

### 7.4 Tenant isolation — TN (highest priority)
| ID | L | Scenario | Expected |
|---|---|---|---|
| TN-01 | I | `A_ADM` lists users / requests / bets / transactions | only Client A rows |
| TN-02 | I | `A_ADM` GET / PATCH / block / reset / delete a **B** user by id | 404; B data unchanged |
| TN-03 | I | `A_ADM` approve / reject a **B** request | 404; still PENDING; balance unchanged |
| TN-04 | I | `A_ADM` sends `clientId=B` (query or body) on list/create | 400 (strict schema) — nothing leaked/created |
| TN-05 | I | Search by B user's email / mobile / name | empty result (no existence leak) |
| TN-06 | I | Pagination `total`, dashboard counts | count only in-scope rows |
| TN-07 | I | ID-enumeration sweep 1..N on every `:id` route with `A_ADM` | foreign ids return **byte-identical** 404 to non-existent ids |
| TN-08 | I | `A_U1` reads other users' bets/requests/notifications/wallet by id | 404 |
| TN-09 | I | SuperAdmin sees all; `?clientId=` filter works | correct |
| TN-10 | I | Every raw-SQL view helper (`fetchBets…`, `fetchWalletRequests`, …) called as A | never returns B rows |
| TN-11 | M | Invariant SQL: `Bet.clientId = User.clientId`, `WalletRequest.clientId = User.clientId` for all rows | 0 violations |
| TN-12 | I | Settle with A and B bets on one market | each credited correctly, no cross-effect |

### 7.5 Client management — CL
| ID | L | Scenario | Expected |
|---|---|---|---|
| CL-01 | I | SA creates Client + first admin | 201; Client + `CLIENT_ADMIN` (clientId set, `mustChangePassword=1`, `createdByUserId`=SA); temp password returned once |
| CL-02 | I | Duplicate admin email / mobile (incl. case variants) | 409; **no Client row created** (atomic) |
| CL-03 | I | Duplicate client code / name | 409 |
| CL-04 | I | Missing / invalid fields | 400 with field errors |
| CL-05 | I | `CLIENT_ADMIN` / `CLIENT_USER` create client | 403 |
| CL-06 | I | List / search / pagination; deleted excluded | correct `total` |
| CL-07 | I | PATCH name; `code` immutable | 200 / 400 |
| CL-08 | I | Deactivate client | users' next request fails; login `CLIENT_INACTIVE`; PENDING requests stay; only SA can resolve them |
| CL-09 | I | Reactivate | all access restored |
| CL-10 | I | Delete client with active users / pending requests | 409 `CLIENT_HAS_ACTIVE_USERS` / `…PENDING_REQUESTS` |
| CL-11 | I | Delete client after users deleted & requests resolved | soft-deleted; admins soft-deleted & cannot log in; `code` anonymised |
| CL-12 | I | Delete twice / unknown id | 404 |
| CL-13 | I | `modifiedByUserId` updated on each change | correct actor |

### 7.6 User management — US
| ID | L | Scenario | Expected |
|---|---|---|---|
| US-01 | I | `A_ADM` creates Client User | 201; role `CLIENT_USER`; `clientId`=A; Wallet ACTIVE 0/0 INR created in same txn; `mustChangePassword=1` |
| US-02 | I | SA creates Client User without `clientId` / with deleted or inactive client | 400 / 404 / 409 |
| US-03 | I | SA creates `CLIENT_ADMIN`; `CLIENT_ADMIN` tries to | 201 / 403 |
| US-04 | I | Any API attempt to create `SUPER_ADMIN` | 400/403 |
| US-05 | I | Duplicate email (case-insens.) / mobile among active users | 409 |
| US-06 | I | Reuse email/mobile of a soft-deleted (anonymised) user | 201 |
| US-07 | I | Validation matrix: name, email, 10-digit mobile, unknown keys | 400 |
| US-08 | I | Temp password: in create response once; never in GET/list/logs | asserted |
| US-09 | I | Block → login 403, requests 403, bet placement 403, funds untouched; unblock restores | correct |
| US-10 | I | Block/unblock idempotent | 200 both times |
| US-11 | I | Block/delete self; last active `CLIENT_ADMIN` | 409 `LAST_ADMIN` |
| US-12 | I | Delete with balance ≠ 0 / locked ≠ 0 / OPEN bet / PENDING request | 409 each, distinct codes |
| US-13 | I | Delete eligible user | `isDeleted=1,isActive=0`; email/mobile/userCode/name anonymised; hash invalidated; bets+ledger still readable by SA |
| US-14 | I | Deleted user's live token | 401 immediately |
| US-15 | I | Reset password by scoped admin | new temp shown once; `mustChangePassword=1`; old tokens invalid; cross-tenant 404; `CLIENT_ADMIN` can't reset SA/admin |
| US-16 | I | PATCH name/email/mobile; `roleId`/`clientId`/`isDeleted` in body | 200 / 400 |
| US-17 | I | List filters (role, isActive, search), sort allow-list, `pageSize>100`, page<1 | correct / 400 |
| US-18 | I | GET user detail: wallet summary for `CLIENT_USER` only | correct |
| US-19 | I | Physical `DELETE FROM "User"` of a user with history | blocked by FK (RESTRICT) |

### 7.7 Fund requests — FR
| ID | L | Scenario | Expected |
|---|---|---|---|
| FR-01 | I | `A_U1` creates INCREASE request | 201 PENDING; `clientId`=A; body `clientId` → 400 |
| FR-02 | I | Amount ≤0, NaN, string, >2 dp, > `Decimal(14,2)` max; empty/oversize reason; bad type | 400 each |
| FR-03 | I | Blocked / deleted user / user of inactive client creates request | 401/403 |
| FR-04 | I | 6th PENDING request from one user | 409 `TOO_MANY_PENDING` |
| FR-05 | I | Visibility: A's queue vs B's; SA sees all; user sees own | correct |
| FR-06 | I | New request notifies every active `CLIENT_ADMIN` of that client only | `WALLET_REQUEST_RECEIVED` rows exact |
| FR-07 | I | Approve INCREASE by own `CLIENT_ADMIN` | wallet `+amount` exact (Decimal; `0.1+0.2` case), 1 `ADMIN_CREDIT` txn, 1 ledger row with correct before/after, `resolvedByUserId`=actor, `resolvedAt`, user notification |
| FR-08 | I | `GET /wallet` right after approve | new balance |
| FR-09 | I | Fault injected mid-transaction | nothing partially written |
| FR-10 | I | Approve twice; 10 parallel approves | exactly 1 success, rest 409; credited once |
| FR-11 | I | Reject; reject-after-approve | REJECTED, wallet unchanged, notification / 409 |
| FR-12 | I | **DECREASE** with sufficient / insufficient funds | debited / 409 `INSUFFICIENT_FUNDS`, stays PENDING, never negative |
| FR-13 | I | DECREASE approval racing 20 parallel bets | balance never negative |
| FR-14 | I | Approve for a user now blocked/deleted | 409 `USER_NOT_ACTIVE` |
| FR-15 | I | Approve by admin of inactive client → 403; by SA → 200 | correct |
| FR-16 | I | Approve by `CLIENT_USER` / unauth / other-tenant admin | 403 / 401 / 404 |
| FR-17 | I | SA approves any client's request | 200; `resolvedByUserId`=SA |
| FR-18 | I | List filters (status, user, date), sort newest first, pagination | correct; uses queue index |
| FR-19 | I | Status/type text comes from views (`vw_wallet_requests`) | correct codes |

### 7.8 Role cache — RC
| ID | L | Scenario | Expected |
|---|---|---|---|
| RC-01 | I | Boot with 3 roles | `ROLE_IDS` populated |
| RC-02 | I | Boot with a required role missing | process exits ≠ 0, clear message |
| RC-03 | I | Periodic refresh fails / returns empty | last-known-good kept, error logged |
| RC-04 | U | Code references an unknown role key | authorization helper throws / denies (never `undefined === undefined`) |

### 7.9 API contract & validation — API
| ID | L | Scenario | Expected |
|---|---|---|---|
| API-01 | I | Error body shape on every admin error | `{error:string, code:string}` |
| API-02 | I | 401 / 403 / 404 / 409 / 400 semantics per §5.2 | as specified |
| API-03 | I | Unknown JSON keys | 400 |
| API-04 | I | Non-integer / negative / huge `:id` | 400 |
| API-05 | I | Malformed JSON; body > limit; non-JSON content-type on mutation | 400 / 413 / 415 |
| API-06 | I | SQL-injection strings in `search` / `sort` / ids | no 500; parameterised; `sort` allow-listed |
| API-07 | I | Unexpected exception | 500 generic body, no stack, logged with request id |
| API-08 | I | CORS: panel origin allowed with credentials, others not | headers correct |
| API-09 | I | Cookie flags: `httpOnly`, `sameSite=lax`, `secure` in production | asserted |

### 7.10 Concurrency — CC
| ID | L | Scenario | Expected |
|---|---|---|---|
| CC-01 | I | 20 parallel creates with the same email | exactly 1×201, rest 409 (`P2002` → 409, never 500) |
| CC-02 | I | Parallel approve vs reject on one request | exactly one wins |
| CC-03 | I | Parallel delete-user vs place-bet | no orphan lock; consistent |
| CC-04 | I | Parallel block vs login | consistent outcome |
| CC-05 | I | Parallel client delete vs user create | no user under a deleted client |

### 7.11 Migration & data — MG
| ID | L | Scenario | Expected |
|---|---|---|---|
| MG-01 | M | `migrate deploy` on empty DB; drift check | success; diff empty |
| MG-02 | M | On DB with current demo data | Rohan → `CLIENT_USER`/Demo Client; admin → `SUPER_ADMIN`, `clientId` NULL; requests/bets get `clientId`; row counts unchanged |
| MG-03 | M | Seeded roles / Demo Client | exactly 3 roles; Demo Client `isActive=1` |
| MG-04 | M | `'admin'` strings → SuperAdmin id in `resolvedByUserId` / `createdByUserId` | 0 NULLs where a string existed |
| MG-05 | M | All `vw_*` views recreated and selectable; include new columns | `SELECT * FROM vw_…` works |
| MG-06 | M | `EXPLAIN` of approval queue, users-by-client, bets-by-client | index scans, no seq scan |
| MG-07 | M | Seed twice | idempotent, no duplicates |
| MG-08 | M | Restore from pre-migration dump | full recovery |
| MG-09 | M | `SUPER_ADMIN ⇔ clientId IS NULL` (trigger if added, else service-level test) | invariant holds |

### 7.12 Performance — PF
Dataset: 50 clients · 100 k users · 1 M bets · 200 k requests.
| ID | Scenario | Target |
|---|---|---|
| PF-01 | Tenant lists (users / requests / bets), page 1 and deep page | p95 < 300 ms |
| PF-02 | Per-request auth actor load overhead | p95 < 5 ms |
| PF-03 | Approval transaction under 50 concurrent approvals | p95 < 250 ms, zero deadlocks |
| PF-04 | Login throughput with rate-limit on | documented ceiling |
| PF-05 | SuperAdmin unfiltered global list | bounded (forced filter / capped) |

### 7.13 Security sweep — SC
| ID | Scenario | Expected |
|---|---|---|
| SC-01 | Mass assignment on every write endpoint (`roleId`, `clientId`, `isDeleted`, `isActive`, `passwordHash`) | 400 |
| SC-02 | Privilege escalation: forge JWT claims; `CLIENT_ADMIN` crafts `SUPER_ADMIN` create | rejected |
| SC-03 | CSRF: cross-site form POST to mutations | rejected (415 / no cookie) |
| SC-04 | Secrets: logs and error bodies contain no passwords / tokens / hashes | asserted |
| SC-05 | Temp password entropy and single display | ≥ 16 chars, one-time |
| SC-06 | Security headers present (`helmet`) | asserted |
| SC-07 | Deleted / anonymised PII not recoverable via API | asserted |

### 7.14 Mobile regression — MB
| ID | L | Scenario | Expected |
|---|---|---|---|
| MB-01 | E | Client User login on mobile web; admin credentials on mobile | works / clear "use the admin panel" message |
| MB-02 | E | Wallet auto-updates after approval (foreground refresh + ≤15 s poll on wallet screen) | new balance without manual refresh |
| MB-03 | E | Request-funds confirmation wording | "sent to your client for approval" |
| MB-04 | E | Blocked/deleted user mid-session | forced logout with message on next 401/403 |
| MB-05 | E | Existing flows: bet place, notifications, crypto chart, wallet history | unchanged |

### 7.15 Admin panel — PN [C] / E2E [E]
| ID | L | Scenario | Expected |
|---|---|---|---|
| PN-01 | C | Menu per role | SA: Dashboard, Clients, Users, Requests, Bets, Markets · CA: Dashboard, Users, Requests, Bets |
| PN-02 | C | Route guard: CA opens `/clients` | redirected to 403 page |
| PN-03 | C | Unauthenticated → `/login`; after login returns to intended route | correct |
| PN-04 | C | API 401 → session cleared + redirect; 403 → toast; network error → retry state | correct |
| PN-05 | C | Forms: client create, user create, change password — validation, disabled while submitting, server field errors mapped | correct |
| PN-06 | C | Temp-password modal shows once, copy works, cannot reopen | correct |
| PN-07 | C | Destructive actions need confirmation (typed name for client delete) | correct |
| PN-08 | C | Tables: server-side pagination/search/sort/filter; state in URL | correct |
| PN-09 | C | Approve/reject buttons only on PENDING; shows resolved-by | correct |
| PN-10 | C | `mustChangePassword` forces change screen | correct |
| E2E-01 | E | **Happy path**: SA creates Client+admin → admin logs in, changes password, creates user → user requests 50 000 → admin approves → user's wallet shows 50 000 → SA settles a market | all steps pass |
| E2E-02 | E | Isolation: A-admin cannot see B's data via UI or by editing the URL to a B id | "not found" page |
| E2E-03 | E | Block user → their mobile session dies on next request | correct |
| E2E-04 | E | Deactivate client → all its users/admins ejected | correct |
| E2E-05 | E | Delete guards surface the server message | correct |
| E2E-06 | E | Session expiry and multi-tab logout | correct |
| E2E-07 | E | No console errors on any page; basic responsive smoke | clean |

### 7.16 Traceability
| Requirement | Tests |
|---|---|
| SuperAdmin has all access | POL-02, RB-01, CL-*, US-02/03, FR-17 |
| Client approves only own users' requests | FR-05/07/16, TN-01/03 |
| Users belong to a Client with a role | US-01, MG-02, POL-01 |
| Users deletable any time (safely) | US-12/13/14, CL-10/11, AUTH-12 |
| Approval reflects immediately | FR-07/08, MB-02 |
| Admin panel manages everything | PN-*, E2E-* |

---

## 8. Panel plan (`admin/`)

**Stack:** Vite · React 18 · TypeScript · React Router · Ant Design · TanStack Query + Table (server-side paging) · react-hook-form + zod · Vitest + RTL · Playwright.
**Auth:** `POST /auth/login {app:'admin'}` → httpOnly `pulseplay_admin_token`; `credentials:'include'`; `GET /auth/me` boots the session; role-aware menus and route guards are UX only — the server is the enforcement point.
**Layout:** `admin/src/{api,auth,components,pages,routes,hooks,utils}`; API types generated from shared zod schemas where practical.

| Step | Screens | Depends on |
|---|---|---|
| A1 | Shell, login, change-password, error/403/404 pages | P2 |
| A2 | Users list / create / edit / block / reset-password / delete | P3 |
| A3 | Fund-request queue (filters, approve/reject, auto-refresh) | P3 |
| A4 | Clients (SuperAdmin): create-with-first-admin, edit, deactivate, delete | P3 |
| A5 | Bets, transactions, dashboard (pending count, users, volume) | P3 |
| A6 | Markets/settle (SuperAdmin), audit log (if A11) | P4/P5 |

---

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Cross-tenant data leak (worst case) | Tenant predicate in the same query as the id; TN-07 sweep; TN-10 for raw-SQL helpers; policy tests |
| Untyped `LOOKUP_IDS`/`ROLE_IDS` typo → silent wrong auth | Fail-closed helpers, RC-02/04, POL-04 |
| Hand-written migration drift | `migrate diff` gate, restore rehearsal (MG-01/08) |
| Login CPU cost (bcrypt) | Rate limit; capacity note PF-04 |
| Revocation delay if actor cache added | Off by default; TTL ≤ 5 s if enabled |
| Scope creep (pool accounting, branding, push) | Listed as non-goals in §1 |

---

## 10. Definition of done (whole programme)
All test IDs in §7 green in CI · `tsc` clean in `server/`, `src/`, `admin/` · migrations apply to an empty DB and to the current demo DB · README/runbook updated · no `X-Admin-Token`, no `'admin'` string actors, no `ADMIN_USER_EMAIL` left in the codebase.
