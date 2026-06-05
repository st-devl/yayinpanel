-- CreateTable
CREATE TABLE "CustomSite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "apiKeyEncrypted" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "CustomSite_connectionStatus_idx" ON "CustomSite"("connectionStatus");

-- CreateIndex
CREATE INDEX "CustomSite_baseUrl_idx" ON "CustomSite"("baseUrl");
