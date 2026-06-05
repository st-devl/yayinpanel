import "server-only";

import { ContentStatus, Platform, ReviewItemStatus } from "@prisma/client";
import { serializePlatformData } from "@/lib/domain/platform-data-store";
import { prisma } from "@/lib/server/prisma";
import type { ProcessedContent } from "@/lib/ai/types";

/** ProcessedContent → ProcessingItem kaydı oluşturur. */
export async function createReviewItem(
  batchId: string,
  item: ProcessedContent
): Promise<string> {
  const platformEnum = platformStringToEnum(item.platform);

  const proposedPlatformData = buildProposedPlatformData(item);

  const record = await prisma.processingItem.create({
    data: {
      batchId,
      reviewStatus: ReviewItemStatus.READY,
      platform: platformEnum,
      accountId: item.targetAccountId,
      contentType: item.contentType,
      proposedPlatformData: JSON.stringify(proposedPlatformData),
      mediaAssignments: JSON.stringify(item.media),
      scheduledAt: item.scheduledAt,
      confidence: item.confidence,
      warnings: JSON.stringify(item.warnings),
      aiNotes: item.aiNotes ?? null
    }
  });

  return record.id;
}

/** ProcessingItem'ı onaylar → ContentCard oluşturur. */
export async function approveItem(itemId: string) {
  const item = await prisma.processingItem.findUnique({
    where: { id: itemId }
  });

  if (!item) throw new Error("Item bulunamadı");
  if (item.reviewStatus === ReviewItemStatus.APPROVED) {
    throw new Error("Bu içerik zaten onaylandı");
  }

  const proposedData = JSON.parse(item.proposedPlatformData) as Record<
    string,
    unknown
  >;
  const platformData = serializePlatformData(item.platform, proposedData);

  const mediaAssignments = JSON.parse(item.mediaAssignments) as Array<{
    fileId: string;
    role: string;
    order?: number;
  }>;

  const primaryMedia =
    mediaAssignments.find((m) => m.role === "featured_image") ??
    mediaAssignments[0];

  const text = extractText(proposedData);
  const status = item.scheduledAt
    ? ContentStatus.SCHEDULED
    : ContentStatus.DRAFT;

  const contentCard = await prisma.contentCard.create({
    data: {
      platform: item.platform,
      accountType: item.platform,
      accountId: item.accountId,
      mediaFileId: primaryMedia?.fileId ?? null,
      text,
      status,
      scheduledAt: item.scheduledAt,
      nextAttemptAt: item.scheduledAt,
      platformData
    }
  });

  await prisma.processingItem.update({
    where: { id: itemId },
    data: {
      reviewStatus: ReviewItemStatus.APPROVED,
      contentCardId: contentCard.id
    }
  });

  await updateBatchApprovedCount(item.batchId);

  return contentCard;
}

/** ProcessingItem'ı günceller (kullanıcı düzenledi). */
export async function updateItemData(
  itemId: string,
  data: {
    proposedPlatformData?: Record<string, unknown>;
    scheduledAt?: Date | null;
    mediaAssignments?: Array<{ fileId: string; role: string; order?: number }>;
  }
): Promise<void> {
  await prisma.processingItem.update({
    where: { id: itemId },
    data: {
      proposedPlatformData: data.proposedPlatformData
        ? JSON.stringify(data.proposedPlatformData)
        : undefined,
      scheduledAt: data.scheduledAt,
      mediaAssignments: data.mediaAssignments
        ? JSON.stringify(data.mediaAssignments)
        : undefined,
      reviewStatus: ReviewItemStatus.EDITED
    }
  });
}

export async function rejectItem(itemId: string): Promise<void> {
  await prisma.processingItem.update({
    where: { id: itemId },
    data: { reviewStatus: ReviewItemStatus.REJECTED }
  });
}

export async function bulkApprove(
  batchId: string,
  itemIds?: string[]
): Promise<number> {
  const where = itemIds?.length
    ? { id: { in: itemIds }, batchId }
    : {
        batchId,
        reviewStatus: { in: [ReviewItemStatus.READY, ReviewItemStatus.EDITED] }
      };

  const items = await prisma.processingItem.findMany({ where });
  let approved = 0;

  for (const item of items) {
    try {
      await approveItem(item.id);
      approved++;
    } catch {
      // Tek item hatası diğerleri durdurmaz
    }
  }

  return approved;
}

export async function bulkReject(
  batchId: string,
  itemIds?: string[]
): Promise<void> {
  const where = itemIds?.length
    ? { id: { in: itemIds }, batchId }
    : { batchId, reviewStatus: ReviewItemStatus.READY };

  await prisma.processingItem.updateMany({
    where,
    data: { reviewStatus: ReviewItemStatus.REJECTED }
  });
}

// --- Yardımcılar ---

function platformStringToEnum(
  platform: "website" | "instagram" | "x"
): Platform {
  if (platform === "instagram") return Platform.INSTAGRAM;
  if (platform === "x") return Platform.X;
  return Platform.CUSTOM_SITE;
}

function buildProposedPlatformData(
  item: ProcessedContent
): Record<string, unknown> {
  if (item.platform === "website") {
    return {
      title: item.title ?? "",
      slug: item.slug ?? "",
      contentHtml: item.contentHtml ?? "",
      excerpt: item.summary ?? "",
      seoTitle: item.seoTitle ?? "",
      seoDescription: item.seoDescription ?? "",
      categories: item.category ? [item.category] : [],
      tags: item.tags ?? [],
      publishStatus: "publish"
    };
  }

  if (item.platform === "instagram") {
    return {
      caption: item.caption ?? item.summary ?? item.title ?? "",
      postType:
        item.contentType === "instagram_carousel" ? "CAROUSEL" : "IMAGE",
      hashtags: item.hashtags ?? [],
      captionStyle: "standard"
    };
  }

  return {
    tweetText: item.tweetText ?? item.title ?? item.summary ?? "",
    threadItems: item.threadItems ?? [],
    linkUrl: "",
    hasMedia: item.media.length > 0,
    isThread: item.contentType === "x_thread"
  };
}

function extractText(data: Record<string, unknown>): string {
  if (typeof data.title === "string" && data.title) return data.title;
  if (typeof data.caption === "string" && data.caption) {
    return data.caption;
  }
  if (typeof data.tweetText === "string" && data.tweetText) {
    const linkUrl = typeof data.linkUrl === "string" ? data.linkUrl.trim() : "";
    const tweetText = data.tweetText.trim();

    if (linkUrl && !tweetText.includes(linkUrl)) {
      return `${tweetText}\n${linkUrl}`;
    }

    return tweetText;
  }
  return "";
}

async function updateBatchApprovedCount(batchId: string): Promise<void> {
  const count = await prisma.processingItem.count({
    where: { batchId, reviewStatus: ReviewItemStatus.APPROVED }
  });

  await prisma.processingBatch.update({
    where: { id: batchId },
    data: { approvedItems: count }
  });
}
