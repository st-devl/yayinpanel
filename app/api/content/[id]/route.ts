import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/server/api-auth";
import {
  cancelContentCard,
  deleteContentCard,
  resolveManualCheck,
  retryContentCard,
  scheduleContentCard,
  updateContentCard
} from "@/lib/server/content-cards";
import { zonedDateTimeInputToUtc } from "@/lib/timezone";

type RouteContext = { params: Promise<{ id: string }> };

const actionSchema = z.object({
  action: z.enum(["schedule", "cancel", "retry", "manual_check"]),
  /** schedule icin yerel (Europe/Istanbul) tarih-saat: YYYY-MM-DDTHH:mm */
  scheduledAt: z.string().optional(),
  /** manual_check icin tekrar kuyruga alinsin mi. */
  requeue: z.boolean().optional()
});

const updateSchema = z.object({
  /** Metin icerigi guncellemek icin. */
  text: z.string().nullable().optional(),
  /** Yerel (Europe/Istanbul) tarih-saat: YYYY-MM-DDTHH:mm. null gelirse plan tarihi temizlenir. */
  scheduledAt: z.string().nullable().optional()
});

/** Kart aksiyonlari: planla, iptal et, tekrar dene, manuel kontrol coz. */
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = actionSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Gecersiz aksiyon" }, { status: 400 });
  }

  const { action } = parsed.data;

  try {
    if (action === "schedule") {
      if (!parsed.data.scheduledAt) {
        return NextResponse.json(
          { error: "scheduledAt gerekli" },
          { status: 400 }
        );
      }
      const scheduledAt = zonedDateTimeInputToUtc(parsed.data.scheduledAt);
      const card = await scheduleContentCard(id, scheduledAt);
      return NextResponse.json({ data: card });
    }

    if (action === "cancel") {
      const result = await cancelContentCard(id);
      if (!result.ok) {
        return NextResponse.json(
          { error: result.reason },
          { status: result.reason === "not_found" ? 404 : 409 }
        );
      }
      return NextResponse.json({ data: result.card });
    }

    if (action === "retry") {
      const card = await retryContentCard(id);
      return NextResponse.json({ data: card });
    }

    const card = await resolveManualCheck(id, parsed.data.requeue ?? true);
    return NextResponse.json({ data: card });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Islem basarisiz";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Gecersiz guncelleme" }, { status: 400 });
  }

  try {
    const card = await updateContentCard(id, {
      text: parsed.data.text,
      scheduledAt:
        parsed.data.scheduledAt === undefined
          ? undefined
          : parsed.data.scheduledAt
            ? zonedDateTimeInputToUtc(parsed.data.scheduledAt)
            : null
    });

    return NextResponse.json({ data: card });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Guncelleme basarisiz";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const result = await deleteContentCard(id);

  if (!result.ok) {
    return NextResponse.json({ error: "Kart bulunamadi" }, { status: 404 });
  }

  return NextResponse.json({ deleted: true });
}
