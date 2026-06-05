import {
  AIProviderType,
  BatchStatus,
  ContentStatus,
  Platform,
  ReviewItemStatus
} from "@prisma/client";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import {
  accountDeletionBlockedMessage,
  getAccountDeletionBlocker
} from "@/lib/server/account-deletion-guard";
import { prisma } from "@/lib/server/prisma";

const testAccountIds = new Set<string>();
const testProviderIds = new Set<string>();

function uniqueAccountId(label: string) {
  const id = `test-delete-${label}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  testAccountIds.add(id);
  return id;
}

function uniqueProviderId(label: string) {
  const id = `test-provider-${label}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  testProviderIds.add(id);
  return id;
}

async function createTestProvider(label: string) {
  const id = uniqueProviderId(label);

  return prisma.aIProvider.create({
    data: {
      apiKeyEncrypted: "test",
      id,
      model: "test-model",
      name: "Test provider",
      providerType: AIProviderType.CUSTOM
    }
  });
}

async function cleanupTestRows() {
  const accountIds = [...testAccountIds];
  const providerIds = [...testProviderIds];

  if (accountIds.length) {
    await prisma.publishLog.deleteMany({
      where: { accountId: { in: accountIds } }
    });
    await prisma.contentCard.deleteMany({
      where: { accountId: { in: accountIds } }
    });
    await prisma.processingItem.deleteMany({
      where: { accountId: { in: accountIds } }
    });
    await prisma.processingBatch.deleteMany({
      where: { accountId: { in: accountIds } }
    });
  }

  if (providerIds.length) {
    await prisma.aIProvider.deleteMany({
      where: { id: { in: providerIds } }
    });
  }

  testAccountIds.clear();
  testProviderIds.clear();
}

afterEach(async () => {
  await cleanupTestRows();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("account deletion guard", () => {
  it("blocks deletion when active cards, batches or review items reference the account", async () => {
    const accountId = uniqueAccountId("active");
    const provider = await createTestProvider("active");

    await prisma.contentCard.create({
      data: {
        accountId,
        accountType: "X",
        platform: Platform.X,
        platformData: JSON.stringify({ hasMedia: false }),
        status: ContentStatus.SCHEDULED,
        text: "Scheduled post"
      }
    });
    const batch = await prisma.processingBatch.create({
      data: {
        accountId,
        aiProviderId: provider.id,
        platform: Platform.X,
        status: BatchStatus.REVIEW_PENDING,
        uploadedFileIds: "[]"
      }
    });
    await prisma.processingItem.create({
      data: {
        accountId,
        batchId: batch.id,
        mediaAssignments: "[]",
        platform: Platform.X,
        proposedPlatformData: JSON.stringify({ hasMedia: false }),
        reviewStatus: ReviewItemStatus.READY
      }
    });

    const blocker = await getAccountDeletionBlocker(Platform.X, accountId);

    expect(blocker).toEqual({
      contentCards: 1,
      processingBatches: 1,
      reviewItems: 1
    });
    expect(accountDeletionBlockedMessage(blocker!)).toContain(
      "Bu hesap silinemez"
    );
  });

  it("allows deletion when only terminal records reference the account", async () => {
    const accountId = uniqueAccountId("terminal");
    const provider = await createTestProvider("terminal");

    await prisma.contentCard.create({
      data: {
        accountId,
        accountType: "X",
        platform: Platform.X,
        platformData: JSON.stringify({ hasMedia: false }),
        status: ContentStatus.PUBLISHED,
        text: "Published post"
      }
    });
    await prisma.processingBatch.create({
      data: {
        accountId,
        aiProviderId: provider.id,
        platform: Platform.X,
        status: BatchStatus.COMPLETED,
        uploadedFileIds: "[]"
      }
    });

    await expect(
      getAccountDeletionBlocker(Platform.X, accountId)
    ).resolves.toBeNull();
  });
});
