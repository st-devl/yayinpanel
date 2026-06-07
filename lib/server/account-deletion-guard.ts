import "server-only";

import {
  BatchStatus,
  ContentStatus,
  Platform,
  ReviewItemStatus
} from "@prisma/client";
import { prisma } from "@/lib/server/prisma";

// FAILED kalici (terminal) bir durumdur; tamamlanamaz, bu yuzden hesabin
// silinmesini engellememeli. Aksi halde basarisiz yayini olan bir hesabi
// kullanici hicbir zaman kaldiramaz.
const activeContentStatuses: ContentStatus[] = [
  ContentStatus.DRAFT,
  ContentStatus.SCHEDULED,
  ContentStatus.PUBLISHING,
  ContentStatus.MANUAL_CHECK_REQUIRED
];

const activeBatchStatuses: BatchStatus[] = [
  BatchStatus.UPLOADING,
  BatchStatus.PROCESSING,
  BatchStatus.REVIEW_PENDING,
  BatchStatus.PARTIALLY_APPROVED
];

const activeReviewStatuses: ReviewItemStatus[] = [
  ReviewItemStatus.PENDING,
  ReviewItemStatus.PROCESSING,
  ReviewItemStatus.READY,
  ReviewItemStatus.EDITED,
  ReviewItemStatus.ERROR
];

export type AccountDeletionBlocker = {
  contentCards: number;
  processingBatches: number;
  reviewItems: number;
};

export async function getAccountDeletionBlocker(
  platform: Platform,
  accountId: string
): Promise<AccountDeletionBlocker | null> {
  const accountReferences = await accountReferencesForDeletion(
    platform,
    accountId
  );

  const [contentCards, processingBatches, reviewItems] = await Promise.all([
    prisma.contentCard.count({
      where: {
        platform,
        accountId: { in: accountReferences },
        status: { in: activeContentStatuses }
      }
    }),
    prisma.processingBatch.count({
      where: {
        platform,
        accountId: { in: accountReferences },
        status: { in: activeBatchStatuses }
      }
    }),
    prisma.processingItem.count({
      where: {
        platform,
        accountId: { in: accountReferences },
        reviewStatus: { in: activeReviewStatuses }
      }
    })
  ]);

  if (contentCards === 0 && processingBatches === 0 && reviewItems === 0) {
    return null;
  }

  return { contentCards, processingBatches, reviewItems };
}

async function accountReferencesForDeletion(
  platform: Platform,
  accountId: string
) {
  if (platform !== Platform.X) {
    return [accountId];
  }

  const account = await prisma.xAccount.findFirst({
    where: { OR: [{ id: accountId }, { xUserId: accountId }] },
    select: { id: true, xUserId: true }
  });

  return account ? [account.id, account.xUserId] : [accountId];
}

export function accountDeletionBlockedMessage(blocker: AccountDeletionBlocker) {
  const parts = [
    blocker.contentCards ? `${blocker.contentCards} içerik kartı` : null,
    blocker.processingBatches
      ? `${blocker.processingBatches} işlem grubu`
      : null,
    blocker.reviewItems ? `${blocker.reviewItems} inceleme öğesi` : null
  ].filter(Boolean);

  return `Bu hesap silinemez; bağlı aktif kayıtlar var (${parts.join(", ")}). Önce bu kayıtları iptal edin, tamamlayın veya yeni hesaba taşıyın.`;
}
