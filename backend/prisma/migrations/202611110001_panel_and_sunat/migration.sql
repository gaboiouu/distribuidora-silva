-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('FACTURA', 'BOLETA', 'NOTA_CREDITO', 'GUIA_REMISION');

-- CreateEnum
CREATE TYPE "SunatStatus" AS ENUM ('PENDING', 'ACCEPTED', 'OBSERVED', 'REJECTED', 'ERROR');

-- CreateEnum
CREATE TYPE "IgvType" AS ENUM ('GRAVADO', 'EXONERADO', 'INAFECTO');

-- AlterTable
ALTER TABLE "Sale"
  ADD COLUMN "status" "SaleStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledBy" UUID,
  ADD COLUMN "cancelReason" TEXT;

CREATE INDEX "Sale_status_idx" ON "Sale"("status");

-- CreateTable
CREATE TABLE "StockAdjustment" (
  "id" UUID NOT NULL,
  "requestKey" UUID NOT NULL,
  "productId" UUID NOT NULL,
  "delta" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "notes" TEXT,
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_adjustment_nonzero" CHECK ("delta" <> 0)
);

CREATE UNIQUE INDEX "StockAdjustment_requestKey_key" ON "StockAdjustment"("requestKey");
CREATE INDEX "StockAdjustment_productId_createdAt_idx" ON "StockAdjustment"("productId", "createdAt");

ALTER TABLE "StockAdjustment"
  ADD CONSTRAINT "StockAdjustment_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "InvoiceSequence" (
  "serie" TEXT NOT NULL,
  "lastNumber" INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("serie"),
  CONSTRAINT "invoice_sequence_nonnegative" CHECK ("lastNumber" >= 0)
);

-- CreateTable
CREATE TABLE "Invoice" (
  "id" UUID NOT NULL,
  "requestKey" UUID NOT NULL,
  "saleId" UUID,
  "relatedInvoiceId" UUID,
  "type" "InvoiceType" NOT NULL,
  "serie" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "customerDocumentType" TEXT NOT NULL,
  "customerDocument" TEXT NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerAddress" TEXT,
  "igvType" "IgvType" NOT NULL DEFAULT 'GRAVADO',
  "subtotal" DECIMAL(12,2) NOT NULL,
  "igv" DECIMAL(12,2) NOT NULL,
  "total" DECIMAL(12,2) NOT NULL,
  "creditNoteCode" TEXT,
  "creditNoteReason" TEXT,
  "guideReasonCode" TEXT,
  "guideTransferStartDate" TIMESTAMP(3),
  "guideGrossWeight" DECIMAL(10,2),
  "guidePackages" INTEGER,
  "guideStartAddress" TEXT,
  "guideEndAddress" TEXT,
  "guideCarrierDoc" TEXT,
  "guideCarrierName" TEXT,
  "guidePlate" TEXT,
  "status" "SunatStatus" NOT NULL DEFAULT 'PENDING',
  "sunatAccepted" BOOLEAN NOT NULL DEFAULT false,
  "sunatDescription" TEXT,
  "sunatNote" TEXT,
  "sunatResponseCode" TEXT,
  "sunatSoapError" TEXT,
  "hashCode" TEXT,
  "qrString" TEXT,
  "pdfUrl" TEXT,
  "xmlUrl" TEXT,
  "cdrUrl" TEXT,
  "providerPayload" JSONB,
  "providerResponse" JSONB,
  "sentAt" TIMESTAMP(3),
  "createdBy" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "invoice_number_positive" CHECK ("number" > 0),
  CONSTRAINT "invoice_amounts_nonnegative" CHECK ("subtotal" >= 0 AND "igv" >= 0 AND "total" >= 0)
);

CREATE UNIQUE INDEX "Invoice_requestKey_key" ON "Invoice"("requestKey");
CREATE UNIQUE INDEX "Invoice_serie_number_key" ON "Invoice"("serie", "number");
CREATE INDEX "Invoice_saleId_idx" ON "Invoice"("saleId");
CREATE INDEX "Invoice_status_createdAt_idx" ON "Invoice"("status", "createdAt");
CREATE INDEX "Invoice_createdAt_idx" ON "Invoice"("createdAt");

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Invoice"
  ADD CONSTRAINT "Invoice_relatedInvoiceId_fkey"
  FOREIGN KEY ("relatedInvoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

