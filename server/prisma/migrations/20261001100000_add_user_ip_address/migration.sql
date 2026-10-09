-- Latest login IP on User (separate from legacy lastLoginIp).
ALTER TABLE "User" ADD COLUMN "ipAddress" TEXT;
