import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/server/api-auth";
import { bulkApprove } from "@/lib/server/review-items";
import { updateBatchStatus } from "@/lib/server/processing-batches";
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

  const approvedCount = await bulkApprove(id, parsed.data.itemIds);

  // Batch durumunu güncelle
  const remaining = await prisma.processingItem.count({
    where: { batchId: id, reviewStatus: { in: ["READY", "EDITED", "PENDING"] } }
  });

  if (remaining === 0) {
    await updateBatchStatus(id, "COMPLETED");
  } else {
    await updateBatchStatus(id, "PARTIALLY_APPROVED");
  }

  return NextResponse.json({ approved: approvedCount });
}
