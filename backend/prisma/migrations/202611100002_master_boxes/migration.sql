ALTER TABLE "Product"
  ADD COLUMN "boxProductId" UUID,
  ADD COLUMN "boxesPerMaster" INTEGER,
  ADD CONSTRAINT "Product_boxProductId_fkey" FOREIGN KEY ("boxProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "product_packaging_valid" CHECK (
    ("boxProductId" IS NULL AND "boxesPerMaster" IS NULL) OR
    ("boxProductId" IS NOT NULL AND "boxesPerMaster" IS NOT NULL AND "boxProductId" <> id AND "boxesPerMaster" BETWEEN 1 AND 10000)
  );
CREATE INDEX "Product_boxProductId_idx" ON "Product"("boxProductId");

CREATE TABLE "StockConversion" (
  "id" UUID NOT NULL PRIMARY KEY,
  "requestKey" UUID NOT NULL UNIQUE,
  "masterProductId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "boxProductId" UUID NOT NULL REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "masterQuantity" INTEGER NOT NULL,
  "boxesPerMaster" INTEGER NOT NULL,
  "boxQuantity" INTEGER NOT NULL,
  "unitCost" DECIMAL(12,2) NOT NULL,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_conversion_valid" CHECK (
    "masterProductId" <> "boxProductId" AND "masterQuantity" > 0 AND
    "boxesPerMaster" BETWEEN 1 AND 10000 AND
    "boxQuantity"::BIGINT = "masterQuantity"::BIGINT * "boxesPerMaster" AND "unitCost" >= 0
  )
);
CREATE INDEX "StockConversion_createdAt_idx" ON "StockConversion"("createdAt");
