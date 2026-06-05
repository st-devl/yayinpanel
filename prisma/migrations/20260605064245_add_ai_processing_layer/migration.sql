-- AlterTable
ALTER TABLE "CustomSite" ADD COLUMN "fieldMappingJson" TEXT;

-- CreateTable
CREATE TABLE "AIProvider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "providerType" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "baseUrl" TEXT,
    "maxTokens" INTEGER,
    "timeoutSeconds" INTEGER NOT NULL DEFAULT 120,
    "monthlyBudgetUsd" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProcessingBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UPLOADING',
    "aiProviderId" TEXT NOT NULL,
    "instructionText" TEXT,
    "uploadedFileIds" TEXT NOT NULL DEFAULT '[]',
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "approvedItems" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProcessingBatch_aiProviderId_fkey" FOREIGN KEY ("aiProviderId") REFERENCES "AIProvider" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProcessingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "batchId" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "platform" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "contentType" TEXT,
    "proposedPlatformData" TEXT NOT NULL DEFAULT '{}',
    "mediaAssignments" TEXT NOT NULL DEFAULT '[]',
    "scheduledAt" DATETIME,
    "confidence" REAL NOT NULL DEFAULT 0,
    "warnings" TEXT NOT NULL DEFAULT '[]',
    "aiNotes" TEXT,
    "contentCardId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProcessingItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ProcessingBatch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AIUsageLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "aiProviderId" TEXT NOT NULL,
    "batchId" TEXT,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL,
    "outputTokens" INTEGER NOT NULL,
    "estimatedCostUsd" REAL,
    "purpose" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIUsageLog_aiProviderId_fkey" FOREIGN KEY ("aiProviderId") REFERENCES "AIProvider" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AIProvider_isDefault_idx" ON "AIProvider"("isDefault");

-- CreateIndex
CREATE INDEX "AIProvider_isActive_idx" ON "AIProvider"("isActive");

-- CreateIndex
CREATE INDEX "ProcessingBatch_status_idx" ON "ProcessingBatch"("status");

-- CreateIndex
CREATE INDEX "ProcessingBatch_platform_accountId_idx" ON "ProcessingBatch"("platform", "accountId");

-- CreateIndex
CREATE INDEX "ProcessingBatch_createdAt_idx" ON "ProcessingBatch"("createdAt");

-- CreateIndex
CREATE INDEX "ProcessingItem_batchId_idx" ON "ProcessingItem"("batchId");

-- CreateIndex
CREATE INDEX "ProcessingItem_reviewStatus_idx" ON "ProcessingItem"("reviewStatus");

-- CreateIndex
CREATE INDEX "ProcessingItem_platform_accountId_idx" ON "ProcessingItem"("platform", "accountId");

-- CreateIndex
CREATE INDEX "AIUsageLog_aiProviderId_idx" ON "AIUsageLog"("aiProviderId");

-- CreateIndex
CREATE INDEX "AIUsageLog_batchId_idx" ON "AIUsageLog"("batchId");

-- CreateIndex
CREATE INDEX "AIUsageLog_createdAt_idx" ON "AIUsageLog"("createdAt");
