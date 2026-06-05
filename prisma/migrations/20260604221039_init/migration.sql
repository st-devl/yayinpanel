-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InstagramAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "instagramBusinessAccountId" TEXT NOT NULL,
    "facebookPageId" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "tokenExpiresAt" DATETIME,
    "connectionStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "XAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "xUserId" TEXT NOT NULL,
    "profileImageUrl" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL,
    "refreshTokenEncrypted" TEXT,
    "tokenExpiresAt" DATETIME,
    "connectionStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "WordPressSite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "applicationPasswordEncrypted" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MediaFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fileName" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "storageType" TEXT NOT NULL DEFAULT 'LOCAL',
    "storagePath" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContentCard" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "mediaFileId" TEXT,
    "text" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "orderNumber" INTEGER,
    "scheduledAt" DATETIME,
    "nextAttemptAt" DATETIME,
    "publishedAt" DATETIME,
    "externalPostId" TEXT,
    "externalPostUrl" TEXT,
    "platformData" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "publishingStartedAt" DATETIME,
    "manualCheckReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContentCard_mediaFileId_fkey" FOREIGN KEY ("mediaFileId") REFERENCES "MediaFile" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublishLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "platform" TEXT NOT NULL,
    "accountId" TEXT,
    "contentCardId" TEXT,
    "action" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "apiResponse" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublishLog_contentCardId_fkey" FOREIGN KEY ("contentCardId") REFERENCES "ContentCard" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "InstagramAccount_connectionStatus_idx" ON "InstagramAccount"("connectionStatus");

-- CreateIndex
CREATE INDEX "InstagramAccount_username_idx" ON "InstagramAccount"("username");

-- CreateIndex
CREATE INDEX "XAccount_connectionStatus_idx" ON "XAccount"("connectionStatus");

-- CreateIndex
CREATE INDEX "XAccount_username_idx" ON "XAccount"("username");

-- CreateIndex
CREATE INDEX "WordPressSite_connectionStatus_idx" ON "WordPressSite"("connectionStatus");

-- CreateIndex
CREATE INDEX "WordPressSite_baseUrl_idx" ON "WordPressSite"("baseUrl");

-- CreateIndex
CREATE INDEX "MediaFile_mimeType_idx" ON "MediaFile"("mimeType");

-- CreateIndex
CREATE INDEX "MediaFile_createdAt_idx" ON "MediaFile"("createdAt");

-- CreateIndex
CREATE INDEX "ContentCard_platform_accountId_idx" ON "ContentCard"("platform", "accountId");

-- CreateIndex
CREATE INDEX "ContentCard_status_scheduledAt_idx" ON "ContentCard"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "ContentCard_status_publishingStartedAt_idx" ON "ContentCard"("status", "publishingStartedAt");

-- CreateIndex
CREATE INDEX "ContentCard_mediaFileId_idx" ON "ContentCard"("mediaFileId");

-- CreateIndex
CREATE INDEX "ContentCard_createdAt_idx" ON "ContentCard"("createdAt");

-- CreateIndex
CREATE INDEX "PublishLog_platform_accountId_idx" ON "PublishLog"("platform", "accountId");

-- CreateIndex
CREATE INDEX "PublishLog_contentCardId_idx" ON "PublishLog"("contentCardId");

-- CreateIndex
CREATE INDEX "PublishLog_status_createdAt_idx" ON "PublishLog"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PublishLog_action_idx" ON "PublishLog"("action");

-- CreateIndex
CREATE UNIQUE INDEX "Setting_key_key" ON "Setting"("key");
