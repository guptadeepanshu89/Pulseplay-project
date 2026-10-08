-- A new lookup VALUE that no route branches on by type — just a data row,
-- exactly like prisma/migrations/*_seed_lookup_reference_data. Notifies a
-- client's approvers when one of their users files a fund request.

INSERT INTO "Lookup" ("lookupTypeId", code, label, "sortOrder", "updatedAt") VALUES
  ((SELECT id FROM "LookupType" WHERE code = 'NOTIFICATION_TYPE'), 'WALLET_REQUEST_RECEIVED', 'Wallet Request Received', 7, now())
ON CONFLICT ("lookupTypeId", code) DO NOTHING;
