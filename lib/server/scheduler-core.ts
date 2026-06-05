import "server-only";

import { ContentStatus, Prisma, PublishLogStatus } from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { publishCard } from "@/lib/server/publish-runner";
import {
  recordSchedulerTickFailure,
  recordSchedulerTickStart,
  recordSchedulerTickSuccess
} from "@/lib/server/scheduler-state";
import { sendTelegramNotification } from "@/lib/server/telegram";

export const MAX_RETRY_COUNT = 5;
/** PUBLISHING durumunda bu sureden uzun kalan kartlar manuel kontrole alinir. */
export const STUCK_PUBLISHING_MINUTES = 15;

const BACKOFF_BASE_SECONDS = 60;
const BACKOFF_MAX_SECONDS = 60 * 30;

/** Exponential backoff: 60s, 120s, 240s ... maks 30dk. */
export function computeBackoffSeconds(retryCount: number): number {
  const seconds = BACKOFF_BASE_SECONDS * 2 ** Math.max(0, retryCount - 1);
  return Math.min(seconds, BACKOFF_MAX_SECONDS);
}

export type SchedulerTickResult = {
  claimed: number;
  published: number;
  retried: number;
  failed: number;
  manualCheck: number;
  dryRun: boolean;
};

export type SchedulerQueueSnapshot = {
  scheduledCount: number;
  dueCount: number;
  retryWaitingCount: number;
  publishingCount: number;
  stuckPublishingCount: number;
  oldestDueAt: Date | null;
  nextScheduledAt: Date | null;
};

function dueCardWhere(now: Date): Prisma.ContentCardWhereInput {
  return {
    status: ContentStatus.SCHEDULED,
    scheduledAt: { lte: now },
    OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }]
  };
}

/** Yayina hazir kartlari bulur (scheduledAt<=now, nextAttemptAt<=now veya null). */
async function findDueCards(now: Date, limit: number) {
  return prisma.contentCard.findMany({
    where: dueCardWhere(now),
    orderBy: { scheduledAt: "asc" },
    take: limit,
    select: {
      id: true,
      platform: true,
      accountId: true,
      text: true,
      mediaFileId: true,
      platformData: true,
      retryCount: true
    }
  });
}

/**
 * Atomik claim: yalnizca status hala SCHEDULED ise PUBLISHING'e gecirir.
 * Iki process ayni anda calissa bile yalnizca biri claim eder.
 */
async function claimCard(cardId: string, now: Date): Promise<boolean> {
  const result = await prisma.contentCard.updateMany({
    where: { id: cardId, ...dueCardWhere(now) },
    data: { status: ContentStatus.PUBLISHING, publishingStartedAt: now }
  });

  return result.count === 1;
}

export async function getSchedulerQueueSnapshot(
  now: Date = new Date()
): Promise<SchedulerQueueSnapshot> {
  const stuckThreshold = new Date(
    now.getTime() - STUCK_PUBLISHING_MINUTES * 60_000
  );

  const [
    scheduledCount,
    dueCount,
    retryWaitingCount,
    publishingCount,
    stuckPublishingCount,
    oldestDue,
    nextScheduled
  ] = await Promise.all([
    prisma.contentCard.count({ where: { status: ContentStatus.SCHEDULED } }),
    prisma.contentCard.count({ where: dueCardWhere(now) }),
    prisma.contentCard.count({
      where: {
        status: ContentStatus.SCHEDULED,
        scheduledAt: { lte: now },
        nextAttemptAt: { gt: now }
      }
    }),
    prisma.contentCard.count({ where: { status: ContentStatus.PUBLISHING } }),
    prisma.contentCard.count({
      where: {
        status: ContentStatus.PUBLISHING,
        publishingStartedAt: { lte: stuckThreshold }
      }
    }),
    prisma.contentCard.findFirst({
      orderBy: { scheduledAt: "asc" },
      select: { scheduledAt: true },
      where: dueCardWhere(now)
    }),
    prisma.contentCard.findFirst({
      orderBy: { scheduledAt: "asc" },
      select: { scheduledAt: true },
      where: {
        status: ContentStatus.SCHEDULED,
        scheduledAt: { gt: now }
      }
    })
  ]);

  return {
    dueCount,
    nextScheduledAt: nextScheduled?.scheduledAt ?? null,
    oldestDueAt: oldestDue?.scheduledAt ?? null,
    publishingCount,
    retryWaitingCount,
    scheduledCount,
    stuckPublishingCount
  };
}

/** Uzun sure PUBLISHING kalan kartlari MANUAL_CHECK_REQUIRED yapar. */
export async function reclaimStuckCards(now: Date): Promise<number> {
  const threshold = new Date(now.getTime() - STUCK_PUBLISHING_MINUTES * 60_000);
  const stuck = await prisma.contentCard.findMany({
    where: {
      status: ContentStatus.PUBLISHING,
      publishingStartedAt: { lte: threshold }
    },
    select: { id: true, platform: true, accountId: true }
  });

  for (const card of stuck) {
    await prisma.contentCard.update({
      where: { id: card.id },
      data: {
        status: ContentStatus.MANUAL_CHECK_REQUIRED,
        manualCheckReason:
          "Yayin cok uzun surdu; cift gonderim riskine karsi otomatik yayinlama durduruldu."
      }
    });
    await prisma.publishLog.create({
      data: {
        platform: card.platform,
        accountId: card.accountId,
        contentCardId: card.id,
        action: "manual_check",
        status: PublishLogStatus.WARNING,
        errorCode: "STUCK_PUBLISHING",
        errorMessage: "Kart uzun sure PUBLISHING durumunda kaldi"
      }
    });
    await sendTelegramNotification({
      kind: "MANUAL_CHECK",
      detail: `Bir kart (${card.id}) uzun sure yayinda kaldi ve manuel kontrole alindi.`,
      action: "Platformda gonderinin yayinlanip yayinlanmadigini kontrol edin."
    });
  }

  return stuck.length;
}

/** Tek bir scheduler dongusu (dry-run destekli). */
export async function runSchedulerTick(options?: {
  dryRun?: boolean;
  now?: Date;
  limit?: number;
  recordState?: boolean;
}): Promise<SchedulerTickResult> {
  const dryRun = options?.dryRun ?? false;
  const now = options?.now ?? new Date();
  const limit = options?.limit ?? 20;
  const shouldRecordState = options?.recordState ?? !dryRun;

  if (shouldRecordState) {
    await safeRecordSchedulerState(() => recordSchedulerTickStart(now));
  }

  try {
    const result: SchedulerTickResult = {
      claimed: 0,
      dryRun,
      failed: 0,
      manualCheck: 0,
      published: 0,
      retried: 0
    };

    result.manualCheck = dryRun ? 0 : await reclaimStuckCards(now);

    const dueCards = await findDueCards(now, limit);

    if (dryRun) {
      result.claimed = dueCards.length;
      if (shouldRecordState) {
        await safeRecordSchedulerState(() =>
          recordSchedulerTickSuccess(result, new Date())
        );
      }
      return result;
    }

    for (const card of dueCards) {
      const claimed = await claimCard(card.id, now);

      if (!claimed) {
        continue;
      }

      result.claimed += 1;
      const outcome = await publishCard(card);

      if (outcome.ok) {
        await prisma.contentCard.update({
          where: { id: card.id },
          data: {
            errorCode: null,
            errorMessage: null,
            externalPostId: outcome.result.externalPostId,
            externalPostUrl: outcome.result.externalPostUrl,
            manualCheckReason: null,
            publishedAt: new Date(),
            status: ContentStatus.PUBLISHED
          }
        });
        result.published += 1;
        continue;
      }

      const error = outcome.error;

      if (error.isTransient && card.retryCount + 1 < MAX_RETRY_COUNT) {
        const nextRetry = card.retryCount + 1;
        const backoff = computeBackoffSeconds(nextRetry);
        await prisma.contentCard.update({
          where: { id: card.id },
          data: {
            errorCode: error.code,
            errorMessage: error.message,
            nextAttemptAt: new Date(now.getTime() + backoff * 1000),
            retryCount: nextRetry,
            status: ContentStatus.SCHEDULED
          }
        });
        result.retried += 1;
        continue;
      }

      // Kalici hata veya retry tukendi -> FAILED + Telegram.
      await prisma.contentCard.update({
        where: { id: card.id },
        data: {
          errorCode: error.code,
          errorMessage: error.message,
          status: ContentStatus.FAILED
        }
      });
      result.failed += 1;

      await sendTelegramNotification({
        action: publishFailureAction(error),
        detail: `Kart ${card.id} yayinlanamadi: ${error.message}`,
        kind: error.isTransient ? "RETRY_EXHAUSTED" : "PUBLISH_FAILED"
      });
    }

    if (shouldRecordState) {
      await safeRecordSchedulerState(() =>
        recordSchedulerTickSuccess(result, new Date())
      );
    }

    return result;
  } catch (error) {
    if (shouldRecordState) {
      await safeRecordSchedulerState(() =>
        recordSchedulerTickFailure(error, new Date())
      );
    }
    throw error;
  }
}

async function safeRecordSchedulerState(operation: () => Promise<void>) {
  try {
    await operation();
  } catch (error) {
    console.error("[scheduler] state write failed", error);
  }
}

function publishFailureAction(error: {
  code: string;
  httpStatus?: number;
  isAuth: boolean;
}) {
  if (error.code.startsWith("X_") && error.httpStatus === 403) {
    return "X Developer Portal'da uygulama izinlerini Read and write yapin ve hesabi X ile yeniden baglayin.";
  }

  if (error.isAuth) {
    return "Ilgili hesabin tokenini yenileyin.";
  }

  return "Icerigi kontrol edip tekrar planlayin.";
}
