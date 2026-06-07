-- X content records should reference the stable X user id, not the mutable
-- local XAccount row id. Existing rows are migrated when the referenced
-- XAccount row is still present.

UPDATE "ContentCard"
SET "accountId" = (
  SELECT "xUserId"
  FROM "XAccount"
  WHERE "XAccount"."id" = "ContentCard"."accountId"
)
WHERE "platform" = 'X'
  AND EXISTS (
    SELECT 1
    FROM "XAccount"
    WHERE "XAccount"."id" = "ContentCard"."accountId"
  );

UPDATE "ProcessingBatch"
SET "accountId" = (
  SELECT "xUserId"
  FROM "XAccount"
  WHERE "XAccount"."id" = "ProcessingBatch"."accountId"
)
WHERE "platform" = 'X'
  AND EXISTS (
    SELECT 1
    FROM "XAccount"
    WHERE "XAccount"."id" = "ProcessingBatch"."accountId"
  );

UPDATE "ProcessingItem"
SET "accountId" = (
  SELECT "xUserId"
  FROM "XAccount"
  WHERE "XAccount"."id" = "ProcessingItem"."accountId"
)
WHERE "platform" = 'X'
  AND EXISTS (
    SELECT 1
    FROM "XAccount"
    WHERE "XAccount"."id" = "ProcessingItem"."accountId"
  );

UPDATE "PublishLog"
SET "accountId" = (
  SELECT "xUserId"
  FROM "XAccount"
  WHERE "XAccount"."id" = "PublishLog"."accountId"
)
WHERE "platform" = 'X'
  AND EXISTS (
    SELECT 1
    FROM "XAccount"
    WHERE "XAccount"."id" = "PublishLog"."accountId"
  );

UPDATE "ContentCard"
SET "errorCode" = NULL,
    "errorMessage" = NULL
WHERE "platform" = 'X'
  AND "status" = 'SCHEDULED'
  AND "errorCode" = 'CREDENTIALS_NOT_FOUND';

CREATE UNIQUE INDEX "XAccount_xUserId_key" ON "XAccount"("xUserId");
