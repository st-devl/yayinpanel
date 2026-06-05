import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/server/api-auth";
import {
  approveItem,
  rejectItem,
  updateItemData
} from "@/lib/server/review-items";
import { prisma } from "@/lib/server/prisma";

type RouteContext = { params: Promise<{ id: string; itemId: string }> };

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject") }),
  z.object({
    action: z.literal("edit"),
    proposedPlatformData: z.record(z.string(), z.unknown()).optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
    mediaAssignments: z
      .array(
        z.object({
          fileId: z.string(),
          role: z.string(),
          order: z.number().optional()
        })
      )
      .optional()
  })
]);

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { itemId } = await context.params;
  const parsed = patchSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz veri", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    if (parsed.data.action === "approve") {
      const card = await approveItem(itemId);
      return NextResponse.json({ data: card });
    }

    if (parsed.data.action === "reject") {
      await rejectItem(itemId);
      return NextResponse.json({ ok: true });
    }

    // edit
    await updateItemData(itemId, {
      proposedPlatformData: parsed.data.proposedPlatformData,
      scheduledAt: parsed.data.scheduledAt
        ? new Date(parsed.data.scheduledAt)
        : parsed.data.scheduledAt === null
          ? null
          : undefined,
      mediaAssignments: parsed.data.mediaAssignments
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "İşlem başarısız" },
      { status: 400 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { itemId } = await context.params;
  const item = await prisma.processingItem.findUnique({ where: { id: itemId } });

  if (!item) {
    return NextResponse.json({ error: "Item bulunamadı" }, { status: 404 });
  }

  await prisma.processingItem.delete({ where: { id: itemId } });
  return NextResponse.json({ deleted: true });
}
