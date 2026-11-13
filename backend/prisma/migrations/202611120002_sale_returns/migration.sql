CREATE TABLE "SaleReturn" (
  "id" UUID NOT NULL,
  "requestKey" UUID NOT NULL,
  "saleId" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "creditAmount" DECIMAL(12,2) NOT NULL,
  "refundAmount" DECIMAL(12,2) NOT NULL,
  "refundMethod" TEXT,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SaleReturn_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SaleReturnItem" (
  "id" UUID NOT NULL,
  "returnId" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "unitPrice" DECIMAL(12,2) NOT NULL,
  "unitCost" DECIMAL(12,2) NOT NULL,
  CONSTRAINT "SaleReturnItem_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SaleReturn_requestKey_key" ON "SaleReturn"("requestKey");
CREATE INDEX "SaleReturn_saleId_createdAt_idx" ON "SaleReturn"("saleId", "createdAt");
CREATE UNIQUE INDEX "SaleReturnItem_returnId_productId_key" ON "SaleReturnItem"("returnId", "productId");
ALTER TABLE "SaleReturn" ADD CONSTRAINT "SaleReturn_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleReturnItem" ADD CONSTRAINT "SaleReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "SaleReturn"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
