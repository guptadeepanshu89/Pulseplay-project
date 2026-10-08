-- AlterTable
ALTER TABLE "Market" ADD COLUMN     "modifiedBy" TEXT;

-- AlterTable
ALTER TABLE "MarketSelection" ADD COLUMN     "modifiedBy" TEXT;

-- vw_markets / vw_market_selections do `SELECT alias.*`, but Postgres expands
-- `*` once at view-creation time — so the new column above wouldn't show up
-- in them until they're recreated (same definitions as before).
DROP VIEW "vw_markets";
DROP VIEW "vw_market_selections";

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
