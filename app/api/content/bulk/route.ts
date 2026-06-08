import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/server/api-auth";
import { bulkScheduleContentCards } from "@/lib/server/content-cards";
import { runSchedulerTick } from "@/lib/server/scheduler-core";
import { zonedDateTimeInputToUtc } from "@/lib/timezone";

// Vakti gelmis kartlar (or. "simdi" planlanan ilk kart) senkron yayinlandigi
// icin istek biraz uzun surebilir.
export const maxDuration = 120;

const bulkSchema = z.object({
  /** Islenecek kart kimlikleri, gosterim sirasinda (araliklar bu siraya gore atanir). */
  cardIds: z.array(z.string().min(1)).min(1),
  /** "now": hepsini hemen yayina al. "interval": baslangictan itibaren araliklarla. */
  mode: z.enum(["now", "interval"]),
  /** interval modunda baslangic: yerel (Europe/Istanbul) YYYY-MM-DDTHH:mm. Yoksa simdi. */
  startAt: z.string().optional(),
  /** interval modunda kartlar arasi dakika cinsinden aralik. */
  intervalMinutes: z.number().int().positive().max(10080).optional()
});

/** Toplu yayina alma: tumunu hemen ya da belirli araliklarla planla. */
export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = bulkSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Gecersiz toplu istek", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { cardIds, mode } = parsed.data;
  const now = new Date();

  let entries: Array<{ id: string; scheduledAt: Date }>;

  if (mode === "now") {
    entries = cardIds.map((id) => ({ id, scheduledAt: now }));
  } else {
    const intervalMinutes = parsed.data.intervalMinutes;
    if (!intervalMinutes) {
      return NextResponse.json(
        { error: "intervalMinutes gerekli" },
        { status: 400 }
      );
    }

    let base: Date;
    try {
      base = parsed.data.startAt
        ? zonedDateTimeInputToUtc(parsed.data.startAt)
        : now;
    } catch {
      return NextResponse.json(
        { error: "Gecersiz baslangic tarihi" },
        { status: 400 }
      );
    }

    const stepMs = intervalMinutes * 60_000;
    entries = cardIds.map((id, index) => ({
      id,
      scheduledAt: new Date(base.getTime() + index * stepMs)
    }));
  }

  try {
    const { updated } = await bulkScheduleContentCards(entries);

    // Vakti gelmis kartlari (scheduledAt <= simdi) 60sn'lik poll'u beklemeden
    // hemen yayinla. "now" modunda hepsi, "interval" modunda ilk kart yayinlanir.
    // Atomik claim sayesinde scheduler process'i ile cakismaz.
    let published = 0;
    try {
      const tick = await runSchedulerTick();
      published = tick.published;
    } catch {
      // Anlik yayin basarisiz olsa bile kartlar planli kaldi; poll devralir.
    }

    return NextResponse.json({
      data: { updated, total: cardIds.length, published }
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Toplu islem basarisiz";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
