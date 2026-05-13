CREATE TYPE "Role" AS ENUM ('ADMIN', 'VIEWER');
CREATE TYPE "PriceField" AS ENUM ('UAE_PRICE', 'IR_PRICE');
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'VIEWER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CachedProduct" (
  "id" TEXT NOT NULL,
  "odooId" INTEGER NOT NULL,
  "name" TEXT NOT NULL,
  "barcode" TEXT,
  "qtyAvailable" DECIMAL(18,4) NOT NULL,
  "sourceHash" TEXT,
  "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "staleAt" TIMESTAMP(3) NOT NULL,
  "lastAccessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CachedProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RegionalPrice" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "uaePriceAed" BIGINT,
  "uaeUpdatedAt" TIMESTAMP(3),
  "irPriceIrr" BIGINT,
  "irUpdatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RegionalPrice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PriceAuditLog" (
  "id" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "changedField" "PriceField" NOT NULL,
  "previousValue" BIGINT,
  "newValue" BIGINT,
  "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "changedById" TEXT,
  CONSTRAINT "PriceAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CacheMetadata" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CacheMetadata_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OdooRequestLog" (
  "id" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "model" TEXT,
  "durationMs" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OdooRequestLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OdooRetryQueue" (
  "id" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "nextRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OdooRetryQueue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "CachedProduct_odooId_key" ON "CachedProduct"("odooId");
CREATE INDEX "CachedProduct_name_idx" ON "CachedProduct"("name");
CREATE INDEX "CachedProduct_barcode_idx" ON "CachedProduct"("barcode");
CREATE INDEX "CachedProduct_staleAt_idx" ON "CachedProduct"("staleAt");
CREATE INDEX "CachedProduct_lastAccessedAt_idx" ON "CachedProduct"("lastAccessedAt");
CREATE UNIQUE INDEX "RegionalPrice_productId_key" ON "RegionalPrice"("productId");
CREATE INDEX "RegionalPrice_uaeUpdatedAt_idx" ON "RegionalPrice"("uaeUpdatedAt");
CREATE INDEX "RegionalPrice_irUpdatedAt_idx" ON "RegionalPrice"("irUpdatedAt");
CREATE INDEX "PriceAuditLog_productId_changedAt_idx" ON "PriceAuditLog"("productId", "changedAt");
CREATE INDEX "PriceAuditLog_changedById_idx" ON "PriceAuditLog"("changedById");
CREATE UNIQUE INDEX "CacheMetadata_key_key" ON "CacheMetadata"("key");
CREATE INDEX "OdooRequestLog_createdAt_idx" ON "OdooRequestLog"("createdAt");
CREATE INDEX "OdooRequestLog_status_idx" ON "OdooRequestLog"("status");
CREATE INDEX "OdooRetryQueue_status_nextRunAt_idx" ON "OdooRetryQueue"("status", "nextRunAt");

ALTER TABLE "RegionalPrice" ADD CONSTRAINT "RegionalPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CachedProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceAuditLog" ADD CONSTRAINT "PriceAuditLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "CachedProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PriceAuditLog" ADD CONSTRAINT "PriceAuditLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
