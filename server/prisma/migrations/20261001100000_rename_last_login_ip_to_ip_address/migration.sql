-- End state is a single User.ipAddress column.
-- The initial migration created lastLoginIp. A later migration may already
-- have added ipAddress, so a blind rename fails with "column already exists".
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'User' AND column_name = 'lastLoginIp'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'User' AND column_name = 'ipAddress'
  ) THEN
    ALTER TABLE "User" RENAME COLUMN "lastLoginIp" TO "ipAddress";
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'User' AND column_name = 'lastLoginIp'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'User' AND column_name = 'ipAddress'
  ) THEN
    UPDATE "User"
    SET "ipAddress" = "lastLoginIp"
    WHERE "ipAddress" IS NULL AND "lastLoginIp" IS NOT NULL;
    ALTER TABLE "User" DROP COLUMN "lastLoginIp";
  END IF;
END $$;
