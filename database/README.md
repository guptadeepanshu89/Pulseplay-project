# Database

## Local development options

### Option A — restore the checked-in demo dump (older snapshot)

`pulseplay_dump.sql` is a point-in-time plain SQL dump of `public` (schema + demo data). It was produced with **PostgreSQL 16.15** and may be **behind** current Prisma migrations (for example it may lack `PasswordResetToken` / settlement columns). Prefer Option B or a fresh backup for current-schema work.

```bash
createdb -U postgres pulseplay
psql -U postgres -d pulseplay -f pulseplay_dump.sql
```

Then point `server/.env` `DATABASE_URL` at that database.

### Option B — migrations + seed (always matches the repo)

```bash
cd server
npx prisma migrate deploy
npx tsx src/seed.ts
```

### Demo logins (either option)

| Role | Email | Password |
|---|---|---|
| Player (`CLIENT_USER`) | `rohan.kumar@example.com` | `password123` |
| Client Admin (`CLIENT_ADMIN`) | `client.admin@example.com` | `DemoAdmin123` |
| SuperAdmin (`SUPER_ADMIN`) | `admin@pulseplay.local` | `DemoAdmin123` |

---

## Backup & restore testing (Issue #2)

These steps use the **live development database only as a read source**. Restores go into an **isolated** database named `pulseplay_backup_test`. The app’s `DATABASE_URL` must stay pointed at the original database.

### Prerequisites

- PostgreSQL client tools (`pg_dump`, `pg_restore`, `psql`). On this machine they live under  
  `C:\Program Files\PostgreSQL\18\bin\` (version **18.6**). Set `PULSEPLAY_PG_BIN` if yours differs.
- `server/.env` with `DATABASE_URL` (credentials are read via `PG*` env vars — never put passwords on the command line).
- A Postgres **superuser** (or a role with `CREATEDB`) to create the empty test database once.

### Create the isolated test database (once)

As a superuser (example):

```sql
CREATE DATABASE pulseplay_backup_test OWNER pulseplay;
```

Do **not** drop or recreate `pulseplay`. If `pulseplay_backup_test` already has tables, the restore script refuses to overwrite it.

### Create a fresh backup

From the repo root:

```powershell
powershell -ExecutionPolicy Bypass -File database/scripts/backup.ps1
```

- Writes a custom-format (`-Fc`) file to `database/local/pulseplay_<timestamp>.dump`
- Validates the archive with `pg_restore -l`
- `database/local/` is gitignored — do not commit dumps (they contain password hashes and live data)

### Restore into the test database

```powershell
powershell -ExecutionPolicy Bypass -File database/scripts/restore.ps1 -TargetDatabase pulseplay_backup_test
```

Optional: `-DumpFile database/local/yourfile.dump`

The script **refuses** targets named `pulseplay`, `postgres`, etc., and requires an empty public schema on the target.

### Verify integrity

```powershell
powershell -ExecutionPolicy Bypass -File database/scripts/verify.ps1 -TargetDatabase pulseplay_backup_test
```

Compares table counts, key row counts, foreign-key orphans, wallet balance sums, and FK constraint counts between source and target (read-only).

**Expected difference:** `PriceHistory` may show `LIVE_DRIFT` if `cryptoFeed` kept inserting rows after the dump was taken. Other business tables should match exactly. Use `-StrictPriceHistory` only when you need an exact match (re-dump with the feed stopped, empty the test DB, restore again).

Exact commands used in the Issue #2 test (PostgreSQL 18.6 tools):

```powershell
& "C:\Program Files\PostgreSQL\18\bin\pg_restore.exe" -l database\local\pulseplay_20261021-173614.dump
powershell -ExecutionPolicy Bypass -File database\scripts\restore.ps1 -TargetDatabase pulseplay_backup_test -DumpFile database\local\pulseplay_20261021-173614.dump
powershell -ExecutionPolicy Bypass -File database\scripts\verify.ps1 -TargetDatabase pulseplay_backup_test
```

Safety: `restore.ps1` refuses target `pulseplay` and other protected names. It also refuses a non-empty `public` schema on the target (no silent overwrite).

### npm shortcuts (repo root)

```bash
npm run db:backup
npm run db:restore -- pulseplay_backup_test
npm run db:verify -- pulseplay_backup_test
```

### Failed backup / restore

- Non-zero exit codes mean failure — do not treat a partial file as success.
- If restore fails mid-way, drop objects in `pulseplay_backup_test` only (or drop that test DB as a superuser) and retry. Never point the cleanup at `pulseplay`.
- Schema drift: a dump from an older app version may lack tables that current migrations add. Prefer a fresh `backup.ps1` from the current `pulseplay` database.

### Keeping secrets out of Git

- Never commit `server/.env` or `database/local/*`
- The historical `pulseplay_dump.sql` already includes demo password hashes; treat new dumps as sensitive
