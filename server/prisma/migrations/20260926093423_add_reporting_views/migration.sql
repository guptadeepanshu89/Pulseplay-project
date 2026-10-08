-- Reporting/DB-browsing views: resolve every *Id lookup FK back to its
-- human-readable code/label, so a raw SQL client (psql, pgAdmin, Prisma
-- Studio) can read a status/category/type without hand-joining "Lookup"
-- every time. The Express API itself does NOT query these views — it uses
-- the in-memory lookup cache (server/src/lib/lookupCache.ts) for the same
-- translation on the hot path, and writes go to the base tables directly
-- (Postgres views here are plain SELECTs, not updatable).

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

CREATE VIEW "vw_bets" AS
SELECT
  b.*,
  stat."code" AS "statusCode", stat."label" AS "statusLabel"
FROM "Bet" b
JOIN "Lookup" stat ON b."statusId" = stat."id";

CREATE VIEW "vw_wallets" AS
SELECT
  w.*,
  stat."code" AS "statusCode", stat."label" AS "statusLabel"
FROM "Wallet" w
JOIN "Lookup" stat ON w."statusId" = stat."id";

CREATE VIEW "vw_wallet_transactions" AS
SELECT
  wt.*,
  typ."code" AS "typeCode", typ."label" AS "typeLabel",
  stat."code" AS "statusCode", stat."label" AS "statusLabel",
  ref."code" AS "referenceTypeCode", ref."label" AS "referenceTypeLabel"
FROM "WalletTransaction" wt
JOIN "Lookup" typ ON wt."typeId" = typ."id"
JOIN "Lookup" stat ON wt."statusId" = stat."id"
LEFT JOIN "Lookup" ref ON wt."referenceTypeId" = ref."id";

CREATE VIEW "vw_wallet_ledger" AS
SELECT
  wl.*,
  typ."code" AS "transactionTypeCode", typ."label" AS "transactionTypeLabel",
  stat."code" AS "statusCode", stat."label" AS "statusLabel",
  ref."code" AS "referenceTypeCode", ref."label" AS "referenceTypeLabel"
FROM "WalletLedger" wl
JOIN "Lookup" typ ON wl."transactionTypeId" = typ."id"
JOIN "Lookup" stat ON wl."statusId" = stat."id"
LEFT JOIN "Lookup" ref ON wl."referenceTypeId" = ref."id";

CREATE VIEW "vw_wallet_requests" AS
SELECT
  wr.*,
  typ."code" AS "typeCode", typ."label" AS "typeLabel",
  stat."code" AS "statusCode", stat."label" AS "statusLabel"
FROM "WalletRequest" wr
JOIN "Lookup" typ ON wr."typeId" = typ."id"
JOIN "Lookup" stat ON wr."statusId" = stat."id";

CREATE VIEW "vw_notifications" AS
SELECT
  n.*,
  typ."code" AS "typeCode", typ."label" AS "typeLabel"
FROM "Notification" n
JOIN "Lookup" typ ON n."typeId" = typ."id";
