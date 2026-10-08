-- Reference/lookup data (LookupType + Lookup rows) lives here, in a
-- migration, not in application code — it's DB history, versioned like any
-- other schema change. The app never hardcodes this list; at runtime it
-- just discovers whatever rows exist here (see server/src/lib/lookupCache.ts).
-- Adding a brand-new lookup VALUE (e.g. a new NOTIFICATION_TYPE) that no
-- route branches on is just another migration like this one — no app code
-- change needed. `label` is only ever set here at first creation; from then
-- on the DB (including a direct edit) is authoritative for it.
--
-- `updatedAt` is set explicitly to now() on every row: Prisma's @updatedAt
-- is Prisma Client behavior, not a DB-level column default, so a raw SQL
-- INSERT (bypassing the client) must set it itself or hit a NOT NULL error.

INSERT INTO "LookupType" (code, name, "updatedAt") VALUES
  ('EVENT_CATEGORY', 'Event Category', now()),
  ('EVENT_STATUS', 'Event Status', now()),
  ('MARKET_STATUS', 'Market Status', now()),
  ('BET_STATUS', 'Bet Status', now()),
  ('WALLET_STATUS', 'Wallet Status', now()),
  ('WALLET_TRANSACTION_TYPE', 'Wallet Transaction Type', now()),
  ('WALLET_TRANSACTION_STATUS', 'Wallet Transaction Status', now()),
  ('REFERENCE_TYPE', 'Reference Type', now()),
  ('WALLET_REQUEST_TYPE', 'Wallet Request Type', now()),
  ('WALLET_REQUEST_STATUS', 'Wallet Request Status', now()),
  ('NOTIFICATION_TYPE', 'Notification Type', now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO "Lookup" ("lookupTypeId", code, label, "sortOrder", "updatedAt") VALUES
  ((SELECT id FROM "LookupType" WHERE code = 'EVENT_CATEGORY'), 'CRICKET', 'Cricket', 0, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'EVENT_CATEGORY'), 'FOOTBALL', 'Football', 1, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'EVENT_CATEGORY'), 'CRYPTO', 'Crypto', 2, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'EVENT_CATEGORY'), 'ELECTION', 'Election', 3, now()),

  ((SELECT id FROM "LookupType" WHERE code = 'EVENT_STATUS'), 'SCHEDULED', 'Scheduled', 0, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'EVENT_STATUS'), 'LIVE', 'Live', 1, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'EVENT_STATUS'), 'COMPLETED', 'Completed', 2, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'EVENT_STATUS'), 'CANCELLED', 'Cancelled', 3, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'EVENT_STATUS'), 'POSTPONED', 'Postponed', 4, now()),

  ((SELECT id FROM "LookupType" WHERE code = 'MARKET_STATUS'), 'OPEN', 'Open', 0, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'MARKET_STATUS'), 'SUSPENDED', 'Suspended', 1, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'MARKET_STATUS'), 'CLOSED', 'Closed', 2, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'MARKET_STATUS'), 'SETTLED', 'Settled', 3, now()),

  ((SELECT id FROM "LookupType" WHERE code = 'BET_STATUS'), 'OPEN', 'Open', 0, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'BET_STATUS'), 'WON', 'Won', 1, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'BET_STATUS'), 'LOST', 'Lost', 2, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'BET_STATUS'), 'VOID', 'Void', 3, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'BET_STATUS'), 'SETTLED', 'Settled', 4, now()),

  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_STATUS'), 'ACTIVE', 'Active', 0, now()),

  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_TRANSACTION_TYPE'), 'BET_LOCK', 'Bet Lock', 0, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_TRANSACTION_TYPE'), 'BET_SETTLEMENT', 'Bet Settlement', 1, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_TRANSACTION_TYPE'), 'BET_REFUND', 'Bet Refund', 2, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_TRANSACTION_TYPE'), 'ADMIN_CREDIT', 'Admin Credit', 3, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_TRANSACTION_TYPE'), 'ADMIN_DEBIT', 'Admin Debit', 4, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_TRANSACTION_TYPE'), 'ADJUSTMENT', 'Adjustment', 5, now()),

  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_TRANSACTION_STATUS'), 'PENDING', 'Pending', 0, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_TRANSACTION_STATUS'), 'COMPLETED', 'Completed', 1, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_TRANSACTION_STATUS'), 'APPROVED', 'Approved', 2, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_TRANSACTION_STATUS'), 'REJECTED', 'Rejected', 3, now()),

  ((SELECT id FROM "LookupType" WHERE code = 'REFERENCE_TYPE'), 'BET', 'Bet', 0, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'REFERENCE_TYPE'), 'WALLET_REQUEST', 'Wallet Request', 1, now()),

  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_REQUEST_TYPE'), 'INCREASE', 'Increase', 0, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_REQUEST_TYPE'), 'DECREASE', 'Decrease', 1, now()),

  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_REQUEST_STATUS'), 'PENDING', 'Pending', 0, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_REQUEST_STATUS'), 'APPROVED', 'Approved', 1, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'WALLET_REQUEST_STATUS'), 'REJECTED', 'Rejected', 2, now()),

  ((SELECT id FROM "LookupType" WHERE code = 'NOTIFICATION_TYPE'), 'WALLET_APPROVED', 'Wallet Approved', 0, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'NOTIFICATION_TYPE'), 'WALLET_REJECTED', 'Wallet Rejected', 1, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'NOTIFICATION_TYPE'), 'BET_PLACED', 'Bet Placed', 2, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'NOTIFICATION_TYPE'), 'BET_SETTLED', 'Bet Settled', 3, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'NOTIFICATION_TYPE'), 'MARKET_SUSPENDED', 'Market Suspended', 4, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'NOTIFICATION_TYPE'), 'MARKET_RESUMED', 'Market Resumed', 5, now()),
  ((SELECT id FROM "LookupType" WHERE code = 'NOTIFICATION_TYPE'), 'ACCOUNT_ALERT', 'Account Alert', 6, now())
ON CONFLICT ("lookupTypeId", code) DO NOTHING;
