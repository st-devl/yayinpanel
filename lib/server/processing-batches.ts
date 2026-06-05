import "server-only";

import { BatchStatus, Platform, Prisma } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";

export const batchSafeSelect = {
  id: true,
  platform: true,
  accountId: true,
  status: true,
  aiProviderId: true,
  instructionText: true,
  uploadedFileIds: true,
  totalItems: true,
  approvedItems: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.ProcessingBatchSelect;

export type SafeProcessingBatch = Prisma.ProcessingBatchGetPayload<{
  select: typeof batchSafeSelect;
}>;

export async function createBatch(input: {
  platform: Platform;
  accountId: string;
  aiProviderId: string;
  instructionText?: string | null;
  uploadedFileIds?: string[];
}): Promise<SafeProcessingBatch> {
  return prisma.processingBatch.create({
    data: {
      platform: input.platform,
      accountId: input.accountId,
      aiProviderId: input.aiProviderId,
      status: BatchStatus.UPLOADING,
      instructionText: input.instructionText ?? null,
      uploadedFileIds: JSON.stringify(input.uploadedFileIds ?? []),
      totalItems: 0,
      approvedItems: 0
    },
    select: batchSafeSelect
  });
}

export async function updateBatchStatus(
  id: string,
  status: BatchStatus,
  extra?: {
    totalItems?: number;
    approvedItems?: number;
    errorMessage?: string | null;
  }
): Promise<SafeProcessingBatch> {
  return prisma.processingBatch.update({
    where: { id },
    data: {
      status,
      totalItems: extra?.totalItems,
      approvedItems: extra?.approvedItems,
      errorMessage: extra?.errorMessage
    },
    select: batchSafeSelect
  });
}

export async function getBatch(id: string): Promise<SafeProcessingBatch | null> {
  return prisma.processingBatch.findUnique({
    where: { id },
    select: batchSafeSelect
  });
}

export async function getBatchWithItems(id: string) {
  return prisma.processingBatch.findUnique({
    where: { id },
    include: {
      items: { orderBy: { createdAt: "asc" } },
      aiProvider: { select: { name: true, providerType: true, model: true } }
    }
  });
}

export async function listPendingBatches() {
  return prisma.processingBatch.findMany({
    where: {
      status: { in: [BatchStatus.REVIEW_PENDING, BatchStatus.PARTIALLY_APPROVED] }
    },
    orderBy: { createdAt: "desc" },
    select: {
      ...batchSafeSelect,
      _count: { select: { items: true } }
    }
  });
}

export async function getPendingReviewCount(): Promise<number> {
  const result = await prisma.processingItem.count({
    where: { reviewStatus: "READY" }
  });

  return result;
}
