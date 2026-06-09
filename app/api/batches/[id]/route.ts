import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/api-auth";
import { getBatchWithItems } from "@/lib/server/processing-batches";
import { prisma } from "@/lib/server/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const batch = await getBatchWithItems(id);

  if (!batch) {
    return NextResponse.json({ error: "Batch bulunamadı" }, { status: 404 });
  }

  return NextResponse.json({ data: batch });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;

  const batch = await prisma.processingBatch.findUnique({ where: { id } });
  if (!batch) {
    return NextResponse.json({ error: "Batch bulunamadı" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.processingItem.deleteMany({ where: { batchId: id } }),
    prisma.processingBatch.delete({ where: { id } })
  ]);

  return NextResponse.json({ deleted: true });
}
