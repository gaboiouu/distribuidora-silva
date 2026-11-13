ALTER TABLE "Purchase" ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT 'CASH', ADD COLUMN "cardName" TEXT, ADD COLUMN "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "Purchase" SET "purchasedAt" = "createdAt";
CREATE TABLE "PurchaseInstallment" (
  "id" UUID NOT NULL,
  "purchaseId" UUID NOT NULL,
  "number" INTEGER NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "dueAt" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  CONSTRAINT "PurchaseInstallment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PurchaseInstallment_purchaseId_number_key" ON "PurchaseInstallment"("purchaseId", "number");
CREATE INDEX "PurchaseInstallment_dueAt_paidAt_idx" ON "PurchaseInstallment"("dueAt", "paidAt");
ALTER TABLE "PurchaseInstallment" ADD CONSTRAINT "PurchaseInstallment_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
