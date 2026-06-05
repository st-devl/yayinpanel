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
  return prisma.contentCard.update({
    where: { id },
    data: {
      scheduledAt,
      status: ContentStatus.SCHEDULED,
      nextAttemptAt: null,
      errorCode: null,
      errorMessage: null
    }
  });
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
        where: {
          id: entry.id,
          status: {
            notIn: [ContentStatus.PUBLISHED, ContentStatus.PUBLISHING]
          }
        },
        data: {
          scheduledAt: entry.scheduledAt,
          status: ContentStatus.SCHEDULED,
          nextAttemptAt: null,
          errorCode: null,
          errorMessage: null
        }
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
    data.scheduledAt = input.scheduledAt;
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
    data: { status: ContentStatus.CANCELED, scheduledAt: null }
  });

  return { ok: true as const, card: updated };
}

/** Hatali/iptal karti tekrar planlama kuyruguna alir. */
export async function retryContentCard(id: string) {
  return prisma.contentCard.update({
    where: { id },
    data: {
      status: ContentStatus.SCHEDULED,
      nextAttemptAt: new Date(),
      errorCode: null,
      errorMessage: null,
      retryCount: 0
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
  return prisma.contentCard.update({
    where: { id },
    data: requeue
      ? {
          status: ContentStatus.SCHEDULED,
          nextAttemptAt: new Date(),
          manualCheckReason: null
        }
      : { status: ContentStatus.CANCELED, manualCheckReason: null }
  });
}
