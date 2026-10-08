-- Role-based access + multi-tenancy (see docs/rbac-multi-tenancy-plan.md, M1-M5).
--
-- Hand-written, not `prisma migrate dev`-generated: the generated version adds
-- NOT NULL columns with no default (fails on existing rows) and has no backfill.
-- Order matters: views first (Postgres refuses to drop/alter a column a view
-- uses), then new tables + reference data, then nullable columns → backfill →
-- NOT NULL, then constraints, then views back, then the safety-net trigger.
-- Constraint/index names match what Prisma generates so `prisma migrate diff`
-- stays empty. Raw INSERTs set "updatedAt" explicitly (Prisma's @updatedAt is
-- client behaviour, not a column default).

-- ---------------------------------------------------------------- M5 (part 1)
-- Every view that does `SELECT alias.*` from a table changed below.
DROP VIEW "vw_bets";
DROP VIEW "vw_wallet_requests";
DROP VIEW "vw_wallet_transactions";
DROP VIEW "vw_wallet_ledger";

-- ------------------------------------------------------------------------ M1
CREATE TABLE "Role" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDeleted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Client" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" INTEGER NOT NULL DEFAULT 1,
    "isDeleted" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" INTEGER,
    "modifiedByUserId" INTEGER,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");
CREATE UNIQUE INDEX "Client_code_key" ON "Client"("code");

INSERT INTO "Role" ("code", "name", "updatedAt") VALUES
  ('SUPER_ADMIN', 'Super Admin', now()),
  ('CLIENT_ADMIN', 'Client Admin', now()),
  ('CLIENT_USER', 'Client User', now());

-- Existing users need a tenant to belong to.
INSERT INTO "Client" ("code", "name", "updatedAt") VALUES ('DEMO', 'Demo Client', now());

-- ------------------------------------------------------------------------ M2
ALTER TABLE "User"
  ADD COLUMN "roleId" INTEGER,
  ADD COLUMN "clientId" INTEGER,
  ADD COLUMN "isActive" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "mustChangePassword" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN "createdByUserId" INTEGER,
  ADD COLUMN "modifiedByUserId" INTEGER;

-- The pre-RBAC admin identity (env ADMIN_USER_EMAIL, default below) becomes the
-- SuperAdmin; every other existing user is a player of the Demo Client.
UPDATE "User"
   SET "roleId" = (SELECT "id" FROM "Role" WHERE "code" = 'SUPER_ADMIN')
 WHERE lower("email") = 'admin@pulseplay.local';

UPDATE "User"
   SET "roleId" = (SELECT "id" FROM "Role" WHERE "code" = 'CLIENT_USER'),
       "clientId" = (SELECT "id" FROM "Client" WHERE "code" = 'DEMO')
 WHERE "roleId" IS NULL;

ALTER TABLE "User" ALTER COLUMN "roleId" SET NOT NULL;

-- ------------------------------------------------------------------------ M3
ALTER TABLE "Bet" ADD COLUMN "clientId" INTEGER;
UPDATE "Bet" b SET "clientId" = u."clientId" FROM "User" u WHERE u."id" = b."userId";
UPDATE "Bet" SET "clientId" = (SELECT "id" FROM "Client" WHERE "code" = 'DEMO') WHERE "clientId" IS NULL;
ALTER TABLE "Bet" ALTER COLUMN "clientId" SET NOT NULL;

ALTER TABLE "WalletRequest"
  ADD COLUMN "clientId" INTEGER,
  ADD COLUMN "resolvedByUserId" INTEGER;
-- WalletRequest.userId has no FK, so guard against an orphan with the Demo fallback.
UPDATE "WalletRequest" wr SET "clientId" = u."clientId" FROM "User" u WHERE u."id" = wr."userId";
UPDATE "WalletRequest" SET "clientId" = (SELECT "id" FROM "Client" WHERE "code" = 'DEMO') WHERE "clientId" IS NULL;
ALTER TABLE "WalletRequest" ALTER COLUMN "clientId" SET NOT NULL;

-- ------------------------------------------------------------------------ M4
-- 'admin' (a free-text actor) → a real user id. Rows written by the old admin
-- token map to the SuperAdmin; if none exists yet they stay NULL.
ALTER TABLE "WalletTransaction" ADD COLUMN "createdByUserId" INTEGER;
ALTER TABLE "WalletLedger" ADD COLUMN "createdByUserId" INTEGER;

UPDATE "WalletRequest"
   SET "resolvedByUserId" = (SELECT u."id" FROM "User" u JOIN "Role" r ON r."id" = u."roleId" WHERE r."code" = 'SUPER_ADMIN' ORDER BY u."id" LIMIT 1)
 WHERE "resolvedBy" IS NOT NULL;
UPDATE "WalletTransaction"
   SET "createdByUserId" = (SELECT u."id" FROM "User" u JOIN "Role" r ON r."id" = u."roleId" WHERE r."code" = 'SUPER_ADMIN' ORDER BY u."id" LIMIT 1)
 WHERE "createdBy" IS NOT NULL;
UPDATE "WalletLedger"
   SET "createdByUserId" = (SELECT u."id" FROM "User" u JOIN "Role" r ON r."id" = u."roleId" WHERE r."code" = 'SUPER_ADMIN' ORDER BY u."id" LIMIT 1)
 WHERE "createdBy" IS NOT NULL;

ALTER TABLE "WalletRequest" DROP COLUMN "resolvedBy";
ALTER TABLE "WalletTransaction" DROP COLUMN "createdBy";
ALTER TABLE "WalletLedger" DROP COLUMN "createdBy";

-- ------------------------------------------------------- indexes + constraints
CREATE INDEX "Bet_clientId_placedAt_idx" ON "Bet"("clientId", "placedAt" DESC);
CREATE INDEX "User_clientId_roleId_isDeleted_idx" ON "User"("clientId", "roleId", "isDeleted");
CREATE INDEX "WalletRequest_clientId_statusId_requestedAt_idx" ON "WalletRequest"("clientId", "statusId", "requestedAt" DESC);

ALTER TABLE "Client" ADD CONSTRAINT "Client_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_modifiedByUserId_fkey" FOREIGN KEY ("modifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_modifiedByUserId_fkey" FOREIGN KEY ("modifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WalletLedger" ADD CONSTRAINT "WalletLedger_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WalletRequest" ADD CONSTRAINT "WalletRequest_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WalletRequest" ADD CONSTRAINT "WalletRequest_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------- M5 (part 2)
-- Same definitions as prisma/migrations/*_add_reporting_views; `alias.*` now
-- picks up the new columns.
CREATE VIEW "vw_bets" AS
SELECT
  b.*,
  stat."code" AS "statusCode", stat."label" AS "statusLabel"
FROM "Bet" b
JOIN "Lookup" stat ON b."statusId" = stat."id";

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

-- ------------------------------------------------------------------ safety net
-- Tenant scoping keys off User.clientId, so a role/client mismatch would be a
-- data-leak waiting to happen: SUPER_ADMIN must have no client, everyone else
-- must have one. Prisma doesn't model triggers; `migrate diff` ignores this.
CREATE FUNCTION "enforce_user_role_client"() RETURNS trigger AS $$
DECLARE
  role_code TEXT;
BEGIN
  SELECT "code" INTO role_code FROM "Role" WHERE "id" = NEW."roleId";
  IF role_code = 'SUPER_ADMIN' AND NEW."clientId" IS NOT NULL THEN
    RAISE EXCEPTION 'SUPER_ADMIN must not belong to a client' USING ERRCODE = '23514';
  END IF;
  IF role_code <> 'SUPER_ADMIN' AND NEW."clientId" IS NULL THEN
    RAISE EXCEPTION 'Role % requires a client', role_code USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "User_role_client_check"
BEFORE INSERT OR UPDATE OF "roleId", "clientId" ON "User"
FOR EACH ROW EXECUTE FUNCTION "enforce_user_role_client"();
