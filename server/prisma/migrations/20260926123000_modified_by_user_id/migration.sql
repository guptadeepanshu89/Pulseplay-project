-- Market/MarketSelection.modifiedBy (free text, was only ever the literal
-- 'admin') becomes modifiedByUserId, an FK to "User" — an admin is just a
-- User row, so "who" is an id like every other reference in this schema.
--
-- The old text column is dropped, not converted: 'admin' has no user id to
-- map to (there was no admin user until now), and the column had existed for
-- minutes with no consumer beyond the settle endpoint.
--
-- vw_markets / vw_market_selections do `SELECT alias.*`, so they depend on
-- the dropped column — drop them first, recreate after (same definitions).

DROP VIEW "vw_markets";
DROP VIEW "vw_market_selections";

ALTER TABLE "Market" DROP COLUMN "modifiedBy";
ALTER TABLE "Market" ADD COLUMN "modifiedByUserId" INTEGER;
ALTER TABLE "Market" ADD CONSTRAINT "Market_modifiedByUserId_fkey" FOREIGN KEY ("modifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MarketSelection" DROP COLUMN "modifiedBy";
ALTER TABLE "MarketSelection" ADD COLUMN "modifiedByUserId" INTEGER;
ALTER TABLE "MarketSelection" ADD CONSTRAINT "MarketSelection_modifiedByUserId_fkey" FOREIGN KEY ("modifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
