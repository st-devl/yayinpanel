import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/server/api-auth";
import { updateBatchStatus } from "@/lib/server/processing-batches";
import { bulkDelete } from "@/lib/server/review-items";
import { prisma } from "@/lib/server/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.object({
  itemIds: z.array(z.string()).optional()
});

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  const deleted = await bulkDelete(id, parsed.data.itemIds);
  const [totalItems, approvedItems, remaining] = await Promise.all([
    prisma.processingItem.count({ where: { batchId: id } }),
    prisma.processingItem.count({
      where: { batchId: id, reviewStatus: "APPROVED" }
    }),
    prisma.processingItem.count({
      where: {
        batchId: id,
        reviewStatus: { in: ["READY", "EDITED", "PENDING", "ERROR"] }
      }
    })
  ]);

  await updateBatchStatus(
    id,
    remaining === 0 ? "COMPLETED" : "PARTIALLY_APPROVED",
    { approvedItems, totalItems }
  );

  return NextResponse.json({ deleted });
}
