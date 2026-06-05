import { AIProviderType, Platform } from "@prisma/client";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import type { ProcessedContent } from "@/lib/ai/types";
import { approveItem, createReviewItem } from "@/lib/server/review-items";
import { prisma } from "@/lib/server/prisma";

const testBatchIds = new Set<string>();
const testCardIds = new Set<string>();
const testProviderIds = new Set<string>();

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function createTestBatch(platform: Platform) {
  const provider = await prisma.aIProvider.create({
    data: {
      apiKeyEncrypted: "test",
      id: uniqueId("test-review-provider"),
      model: "test-model",
      name: "Test provider",
      providerType: AIProviderType.CUSTOM
    }
  });
  testProviderIds.add(provider.id);

  const batch = await prisma.processingBatch.create({
    data: {
      accountId: uniqueId("test-review-account"),
      aiProviderId: provider.id,
      platform,
      uploadedFileIds: "[]"
    }
  });
  testBatchIds.add(batch.id);

  return batch;
}

afterEach(async () => {
  const cardIds = [...testCardIds];
  const batchIds = [...testBatchIds];
  const providerIds = [...testProviderIds];

  if (cardIds.length) {
    await prisma.publishLog.deleteMany({
      where: { contentCardId: { in: cardIds } }
    });
    await prisma.contentCard.deleteMany({ where: { id: { in: cardIds } } });
  }

  if (batchIds.length) {
    await prisma.processingItem.deleteMany({
      where: { batchId: { in: batchIds } }
    });
    await prisma.processingBatch.deleteMany({
      where: { id: { in: batchIds } }
    });
  }

  if (providerIds.length) {
    await prisma.aIProvider.deleteMany({
      where: { id: { in: providerIds } }
    });
  }

  testBatchIds.clear();
  testCardIds.clear();
  testProviderIds.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("review items", () => {
  it("keeps X tweet text through review approval", async () => {
    const batch = await createTestBatch(Platform.X);
    const itemId = await createReviewItem(batch.id, {
      aiNotes: "",
      confidence: 0.95,
      confidenceLevel: "HIGH",
      contentType: "x_post",
      media: [],
      platform: "x",
      scheduledAt: new Date("2026-06-05T09:00:00.000Z"),
      scheduleIsInferred: false,
      targetAccountId: batch.accountId,
      threadItems: [],
      tweetText: "HekimEfendi için deneme gönderi metni",
      warnings: []
    } satisfies ProcessedContent);

    const item = await prisma.processingItem.findUniqueOrThrow({
      where: { id: itemId }
    });
    expect(JSON.parse(item.proposedPlatformData)).toMatchObject({
      tweetText: "HekimEfendi için deneme gönderi metni"
    });

    const card = await approveItem(itemId);
    testCardIds.add(card.id);

    expect(card.platform).toBe(Platform.X);
    expect(card.text).toBe("HekimEfendi için deneme gönderi metni");
  });

  it("keeps Instagram caption through review approval", async () => {
    const batch = await createTestBatch(Platform.INSTAGRAM);
    const itemId = await createReviewItem(batch.id, {
      aiNotes: "",
      caption: "Instagram açıklama metni",
      confidence: 0.9,
      confidenceLevel: "HIGH",
      contentType: "instagram_post",
      hashtags: ["saglik", "hekim"],
      media: [],
      platform: "instagram",
      scheduledAt: null,
      scheduleIsInferred: false,
      targetAccountId: batch.accountId,
      warnings: []
    } satisfies ProcessedContent);

    const card = await approveItem(itemId);
    testCardIds.add(card.id);

    expect(card.platform).toBe(Platform.INSTAGRAM);
    expect(card.text).toBe("Instagram açıklama metni");
  });
});
