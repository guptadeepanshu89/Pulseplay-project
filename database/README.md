# Database

`pulseplay_dump.sql` is a full dump (schema + data, `public` schema) of the dev database at the point this was shared — the demo Client, the 3 seeded users, sample events/markets/bets/wallet activity. Restoring it is the fastest way to get a working copy with real-looking data instead of empty tables.

## Option A — restore this dump (has demo data)

```bash
createdb -U postgres pulseplay          # or whatever role/db server/.env.example says to use
psql -U postgres -d pulseplay -f pulseplay_dump.sql
```

Then just point `server/.env`'s `DATABASE_URL` at that database (see `server/.env.example`) — no need to run migrations or seed, this dump already has everything applied.

## Option B — start empty and build it up yourself (no demo data, always in sync with the code)

```bash
cd server
npx prisma migrate deploy   # creates the schema from prisma/migrations/
npx tsx src/seed.ts         # (optional) seeds the same demo data fresh
```

This is what the main README's Setup section walks through, and it's the one to prefer once you're actively developing — the dump is a point-in-time snapshot and won't pick up a schema change made after it was taken; `migrate deploy` always will.

## Demo logins (either option)

| Role | Email | Password |
|---|---|---|
| Player (`CLIENT_USER`) | `rohan.kumar@example.com` | `password123` |
| Client Admin (`CLIENT_ADMIN`) | `client.admin@example.com` | `DemoAdmin123` |
| SuperAdmin (`SUPER_ADMIN`) | `admin@pulseplay.local` | `DemoAdmin123` |
