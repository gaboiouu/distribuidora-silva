ALTER TABLE "Invoice"
  ADD COLUMN "requestFingerprint" TEXT,
  ADD COLUMN "cancelSaleOnAcceptance" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "syncLockToken" UUID,
  ADD COLUMN "syncLockedUntil" TIMESTAMP(3),
  ADD COLUMN "lastSyncedAt" TIMESTAMP(3),
  ADD COLUMN "lastSyncError" TEXT,
  ADD COLUMN "voided" BOOLEAN NOT NULL DEFAULT false;
