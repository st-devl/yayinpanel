import "server-only";

import { ContentStatus, Platform, Prisma } from "@prisma/client";
import { serializePlatformData } from "@/lib/domain/platform-data-store";
import { prisma } from "@/lib/server/prisma";

export type CreateContentCardInput = {
  platform: Platform;
  accountId: string;
  accountType: string;
  text?: string | null;
  mediaFileId?: string | null;
  orderNumber?: number | null;
  scheduledAt?: Date | null;
  status?: ContentStatus;
  platformData: unknown;
};

const accountTypeByPlatform: Record<Platform, string> = {
  [Platform.INSTAGRAM]: "INSTAGRAM",
  [Platform.X]: "X",
  [Platform.WORDPRESS]: "WORDPRESS",
  [Platform.CUSTOM_SITE]: "CUSTOM_SITE"
};

const unschedulableStatuses = [
  ContentStatus.PUBLISHED,
  ContentStatus.PUBLISHING
] as const;

function scheduledQueueData(scheduledAt: Date) {
  return {
    errorCode: null,
    errorMessage: null,
    externalPostId: null,
    externalPostUrl: null,
    manualCheckReason: null,
    nextAttemptAt: null,
    publishedAt: null,
    publishingStartedAt: null,
    retryCount: 0,
    scheduledAt,
    status: ContentStatus.SCHEDULED
  };
}

/** Tek bir icerik kartini dogrulayip olusturur (platformData validate edilir). */
export async function createContentCard(input: CreateContentCardInput) {
  const platformData = serializePlatformData(
    input.platform,
    input.platformData
  );
  const status =
    input.status ??
    (input.scheduledAt ? ContentStatus.SCHEDULED : ContentStatus.DRAFT);

  return prisma.contentCard.create({
    data: {
      platform: input.platform,
      accountId: input.accountId,
      accountType: input.accountType ?? accountTypeByPlatform[input.platform],
      text: input.text ?? null,
      mediaFileId: input.mediaFileId ?? null,
      orderNumber: input.orderNumber ?? null,
      scheduledAt: input.scheduledAt ?? null,
      status,
      platformData
    }
  });
}

/** Birden cok karti tek islemde olusturur (toplu panel akislari icin). */
export async function createContentCardsBulk(inputs: CreateContentCardInput[]) {
  return prisma.$transaction(
    inputs.map((input) => {
      const platformData = serializePlatformData(
        input.platform,
        input.platformData
      );
      const status =
        input.status ??
        (input.scheduledAt ? ContentStatus.SCHEDULED : ContentStatus.DRAFT);

      return prisma.contentCard.create({
        data: {
          platform: input.platform,
          accountId: input.accountId,
          accountType:
            input.accountType ?? accountTypeByPlatform[input.platform],
          text: input.text ?? null,
          mediaFileId: input.mediaFileId ?? null,
          orderNumber: input.orderNumber ?? null,
          scheduledAt: input.scheduledAt ?? null,
          status,
          platformData
        }
      });
    })
  );
}

export type ContentCardFilter = {
  platform?: Platform;
  accountId?: string;
  status?: ContentStatus;
  from?: Date;
  to?: Date;
  take?: number;
};

export async function listContentCards(filter: ContentCardFilter = {}) {
  const where: Prisma.ContentCardWhereInput = {
    platform: filter.platform,
    accountId: filter.accountId,
    status: filter.status
  };

  if (filter.from || filter.to) {
    where.scheduledAt = {
      gte: filter.from,
      lte: filter.to
    };
  }

  return prisma.contentCard.findMany({
    where,
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "desc" }],
    take: Math.min(filter.take ?? 100, 200),
    include: { mediaFile: true }
  });
}

/** Bir karti planlar (status -> SCHEDULED, scheduledAt set). */
export async function scheduleContentCard(id: string, scheduledAt: Date) {
  const result = await prisma.contentCard.updateMany({
    where: {
      id,
      status: { notIn: [...unschedulableStatuses] }
    },
    data: scheduledQueueData(scheduledAt)
  });

  if (result.count !== 1) {
    throw new Error("Kart bulunamadi veya yayin durumundayken planlanamaz.");
  }

  return prisma.contentCard.findUniqueOrThrow({ where: { id } });
}

function scheduleWhereForId(id: string): Prisma.ContentCardWhereInput {
  return {
    id,
    status: {
      notIn: [...unschedulableStatuses]
    }
  };
}

/**
 * Birden fazla karti toplu olarak planlar. Her kart icin ayri bir scheduledAt
 * verilebilir (araliklarla yayinlama icin). Yalnizca yayinlanmamis ve
 * yayinlanmamakta olan kartlar guncellenir; PUBLISHED/PUBLISHING kartlar atlanir.
 * Gercekte guncellenen kart sayisini dondurur.
 */
export async function bulkScheduleContentCards(
  entries: Array<{ id: string; scheduledAt: Date }>
) {
  if (entries.length === 0) {
    return { updated: 0 };
  }

  const results = await prisma.$transaction(
    entries.map((entry) =>
      prisma.contentCard.updateMany({
        where: scheduleWhereForId(entry.id),
        data: scheduledQueueData(entry.scheduledAt)
      })
    )
  );

  const updated = results.reduce((sum, result) => sum + result.count, 0);
  return { updated };
}

export async function updateContentCard(
  id: string,
  input: {
    text?: string | null;
    scheduledAt?: Date | null;
    status?: ContentStatus;
  }
) {
  const data: Prisma.ContentCardUpdateInput = {};

  if ("text" in input) {
    data.text = input.text;
  }

  if ("scheduledAt" in input) {
    if (input.scheduledAt) {
      Object.assign(data, scheduledQueueData(input.scheduledAt));
    } else {
      data.nextAttemptAt = null;
      data.scheduledAt = null;
      data.status = input.status ?? ContentStatus.DRAFT;
    }
  }

  if (input.status) {
    data.status = input.status;
  }

  return prisma.contentCard.update({
    where: { id },
    data
  });
}

/** Yayini iptal eder (yalnizca yayinlanmamis kartlar icin). */
export async function cancelContentCard(id: string) {
  const card = await prisma.contentCard.findUnique({ where: { id } });

  if (!card) {
    return { ok: false as const, reason: "not_found" as const };
  }

  if (card.status === ContentStatus.PUBLISHED) {
    return { ok: false as const, reason: "already_published" as const };
  }

  const updated = await prisma.contentCard.update({
    where: { id },
    data: {
      nextAttemptAt: null,
      publishingStartedAt: null,
      scheduledAt: null,
      status: ContentStatus.CANCELED
    }
  });

  return { ok: true as const, card: updated };
}

/** Hatali/iptal karti tekrar planlama kuyruguna alir. */
export async function retryContentCard(id: string) {
  const card = await prisma.contentCard.findUnique({ where: { id } });

  if (!card) {
    throw new Error("Kart bulunamadi.");
  }

  if (unschedulableStatuses.some((status) => status === card.status)) {
    throw new Error("Yayinlanmis veya yayindaki kart tekrar kuyruga alinamaz.");
  }

  const now = new Date();
  return prisma.contentCard.update({
    where: { id },
    data: {
      ...scheduledQueueData(now),
      nextAttemptAt: now,
      scheduledAt: now
    }
  });
}

export async function deleteContentCard(id: string) {
  const card = await prisma.contentCard.findUnique({ where: { id } });

  if (!card) {
    return { ok: false as const, reason: "not_found" as const };
  }

  await prisma.contentCard.delete({ where: { id } });
  return { ok: true as const };
}

/** Manuel kontrol gerektiren karti normal kuyruga geri alir. */
export async function resolveManualCheck(id: string, requeue: boolean) {
  if (!requeue) {
    return prisma.contentCard.update({
      where: { id },
      data: {
        manualCheckReason: null,
        nextAttemptAt: null,
        scheduledAt: null,
        status: ContentStatus.CANCELED
      }
    });
  }

  const card = await prisma.contentCard.findUniqueOrThrow({ where: { id } });
  const now = new Date();
  const scheduledAt =
    card.scheduledAt && card.scheduledAt > now ? card.scheduledAt : now;

  return prisma.contentCard.update({
    where: { id },
    data: {
      ...scheduledQueueData(scheduledAt),
      nextAttemptAt: now
    }
  });
}
