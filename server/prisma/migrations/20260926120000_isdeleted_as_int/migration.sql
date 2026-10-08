-- isDeleted moves from BOOLEAN to INTEGER (0/1) on every master table.
-- USING converts existing values instead of dropping the column (Prisma's
-- own destructive-change detector would drop+recreate it, losing any real
-- data — this migration is hand-written specifically to avoid that).
--
-- vw_events/vw_markets/vw_market_selections/vw_wallets each do `SELECT
-- alias.*` from a table with isDeleted, so Postgres refuses to ALTER that
-- column's type while the view depends on it — drop those 4 views first,
-- alter, then recreate them identically (copied from
-- prisma/migrations/*_add_reporting_views/migration.sql).

DROP VIEW "vw_events";
DROP VIEW "vw_markets";
DROP VIEW "vw_market_selections";
DROP VIEW "vw_wallets";

ALTER TABLE "LookupType" ALTER COLUMN "isDeleted" DROP DEFAULT;
ALTER TABLE "LookupType" ALTER COLUMN "isDeleted" TYPE INTEGER USING (CASE WHEN "isDeleted" THEN 1 ELSE 0 END);
ALTER TABLE "LookupType" ALTER COLUMN "isDeleted" SET DEFAULT 0;

ALTER TABLE "Lookup" ALTER COLUMN "isDeleted" DROP DEFAULT;
ALTER TABLE "Lookup" ALTER COLUMN "isDeleted" TYPE INTEGER USING (CASE WHEN "isDeleted" THEN 1 ELSE 0 END);
ALTER TABLE "Lookup" ALTER COLUMN "isDeleted" SET DEFAULT 0;

ALTER TABLE "User" ALTER COLUMN "isDeleted" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "isDeleted" TYPE INTEGER USING (CASE WHEN "isDeleted" THEN 1 ELSE 0 END);
ALTER TABLE "User" ALTER COLUMN "isDeleted" SET DEFAULT 0;

ALTER TABLE "Event" ALTER COLUMN "isDeleted" DROP DEFAULT;
ALTER TABLE "Event" ALTER COLUMN "isDeleted" TYPE INTEGER USING (CASE WHEN "isDeleted" THEN 1 ELSE 0 END);
ALTER TABLE "Event" ALTER COLUMN "isDeleted" SET DEFAULT 0;

ALTER TABLE "Market" ALTER COLUMN "isDeleted" DROP DEFAULT;
ALTER TABLE "Market" ALTER COLUMN "isDeleted" TYPE INTEGER USING (CASE WHEN "isDeleted" THEN 1 ELSE 0 END);
ALTER TABLE "Market" ALTER COLUMN "isDeleted" SET DEFAULT 0;

ALTER TABLE "MarketSelection" ALTER COLUMN "isDeleted" DROP DEFAULT;
ALTER TABLE "MarketSelection" ALTER COLUMN "isDeleted" TYPE INTEGER USING (CASE WHEN "isDeleted" THEN 1 ELSE 0 END);
ALTER TABLE "MarketSelection" ALTER COLUMN "isDeleted" SET DEFAULT 0;

ALTER TABLE "Wallet" ALTER COLUMN "isDeleted" DROP DEFAULT;
ALTER TABLE "Wallet" ALTER COLUMN "isDeleted" TYPE INTEGER USING (CASE WHEN "isDeleted" THEN 1 ELSE 0 END);
ALTER TABLE "Wallet" ALTER COLUMN "isDeleted" SET DEFAULT 0;

CREATE VIEW "vw_events" AS
SELECT
  e.*,
  cat."code" AS "categoryCode", cat."label" AS "categoryLabel",
  stat."code" AS "statusCode", stat."label" AS "statusLabel"
FROM "Event" e
JOIN "Lookup" cat ON e."categoryId" = cat."id"
JOIN "Lookup" stat ON e."statusId" = stat."id";

CREATE VIEW "vw_markets" AS
SELECT
  m.*,
  stat."code" AS "statusCode", stat."label" AS "statusLabel"
FROM "Market" m
JOIN "Lookup" stat ON m."statusId" = stat."id";

CREATE VIEW "vw_market_selections" AS
SELECT
  ms.*,
  stat."code" AS "statusCode", stat."label" AS "statusLabel"
FROM "MarketSelection" ms
JOIN "Lookup" stat ON ms."statusId" = stat."id";

CREATE VIEW "vw_wallets" AS
SELECT
  w.*,
  stat."code" AS "statusCode", stat."label" AS "statusLabel"
FROM "Wallet" w
JOIN "Lookup" stat ON w."statusId" = stat."id";
