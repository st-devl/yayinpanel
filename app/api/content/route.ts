import { NextRequest, NextResponse } from "next/server";
import { ContentStatus, Platform } from "@prisma/client";
import { z } from "zod";
import { isXTextOverLimit } from "@/lib/domain/x-text";
import { requireApiUser } from "@/lib/server/api-auth";
import {
  CreateContentCardInput,
  createContentCardsBulk,
  listContentCards
} from "@/lib/server/content-cards";
import { getSetting } from "@/lib/server/settings";
import { prisma } from "@/lib/server/prisma";
import { buildBulkSchedule, type ScheduleFrequency } from "@/lib/timezone";

const itemSchema = z.object({
  text: z.string().optional(),
  mediaFileId: z.string().optional(),
  platformData: z.unknown().optional()
});

const scheduleSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  frequency: z.enum(["daily", "every_two_days", "weekly"]),
  skipWeekends: z.boolean().optional()
});

const bulkSchema = z.object({
  platform: z.nativeEnum(Platform),
  accountId: z.string().min(1),
  items: z.array(itemSchema).min(1).max(100),
  schedule: scheduleSchema.optional(),
  saveAsDraft: z.boolean().optional()
});

function serializeCard<T extends { scheduledAt: Date | null; createdAt: Date }>(
  card: T
) {
  return {
    ...card,
    scheduledAt: card.scheduledAt?.toISOString() ?? null,
    createdAt: card.createdAt.toISOString()
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { searchParams } = request.nextUrl;
  const platform = searchParams.get("platform");
  const status = searchParams.get("status");

  const cards = await listContentCards({
    platform:
      platform && platform in Platform ? (platform as Platform) : undefined,
    accountId: searchParams.get("accountId") ?? undefined,
    status:
      status && status in ContentStatus ? (status as ContentStatus) : undefined,
    from: searchParams.get("from")
      ? new Date(searchParams.get("from") as string)
      : undefined,
    to: searchParams.get("to")
      ? new Date(searchParams.get("to") as string)
      : undefined
  });

  return NextResponse.json({ data: cards.map(serializeCard) });
}

/** Toplu kart olusturma: panel akislari icin ortak depoya yazar. */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const parsed = bulkSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Gecersiz icerik verisi", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { platform, accountId, items, schedule, saveAsDraft } = parsed.data;

  // Hesap dogrulamasi (aktif hesap zorunlu).
  const accountExists = await accountExistsForPlatform(platform, accountId);
  if (!accountExists) {
    return NextResponse.json(
      { error: "Secili hesap bulunamadi veya gecersiz" },
      { status: 400 }
    );
  }

  // Platforma ozel dogrulamalar.
  const validationError = await validateItems(
    platform,
    items,
    Boolean(schedule)
  );
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  // IG gunluk limit uyarisi (planlama yapiliyorsa).
  if (platform === Platform.INSTAGRAM && schedule) {
    const limit = Number(await getSetting("IG_DAILY_POST_LIMIT"));
    if (Number.isFinite(limit) && items.length > limit) {
      return NextResponse.json(
        {
          error: `Instagram gunluk limiti (${limit}) asiliyor. ${items.length} gonderi planlanamaz.`
        },
        { status: 400 }
      );
    }
  }

  const scheduledDates =
    schedule && !saveAsDraft
      ? buildBulkSchedule({
          startDate: schedule.startDate,
          startTime: schedule.startTime,
          frequency: schedule.frequency as ScheduleFrequency,
          skipWeekends: schedule.skipWeekends,
          count: items.length
        })
      : null;

  const inputs: CreateContentCardInput[] = items.map((item, index) => ({
    platform,
    accountId,
    accountType: platform,
    text: item.text ?? null,
    mediaFileId: item.mediaFileId ?? null,
    orderNumber: index + 1,
    scheduledAt: scheduledDates ? scheduledDates[index] : null,
    status: scheduledDates ? ContentStatus.SCHEDULED : ContentStatus.DRAFT,
    platformData: buildPlatformData(platform, item)
  }));

  const created = await createContentCardsBulk(inputs);

  return NextResponse.json(
    { data: created.map(serializeCard), count: created.length },
    { status: 201 }
  );
}

async function accountExistsForPlatform(platform: Platform, accountId: string) {
  if (platform === Platform.INSTAGRAM) {
    return Boolean(
      await prisma.instagramAccount.findUnique({ where: { id: accountId } })
    );
  }
  if (platform === Platform.X) {
    return Boolean(
      await prisma.xAccount.findUnique({ where: { id: accountId } })
    );
  }
  return Boolean(
    await prisma.wordPressSite.findUnique({ where: { id: accountId } })
  );
}

async function validateItems(
  platform: Platform,
  items: z.infer<typeof itemSchema>[],
  isScheduling: boolean
): Promise<string | null> {
  if (platform === Platform.INSTAGRAM) {
    // Instagram icin gorsel zorunlu (planlama yapiliyorsa).
    if (isScheduling && items.some((item) => !item.mediaFileId)) {
      return "Instagram gonderileri icin her kart bir gorsel icermelidir.";
    }
  }

  if (platform === Platform.X) {
    const overLimit = items.find((item) => isXTextOverLimit(item.text ?? ""));
    if (overLimit) {
      return "Bir veya daha fazla tweet 280 karakter limitini asiyor.";
    }
    if (items.some((item) => !(item.text ?? "").trim())) {
      return "Tweet metni bos olamaz.";
    }
  }

  return null;
}

function buildPlatformData(
  platform: Platform,
  item: z.infer<typeof itemSchema>
): unknown {
  if (item.platformData) {
    return item.platformData;
  }
  if (platform === Platform.INSTAGRAM) {
    return { postType: "IMAGE", hashtags: [] };
  }
  if (platform === Platform.X) {
    return { hasMedia: Boolean(item.mediaFileId) };
  }
  return {};
}
