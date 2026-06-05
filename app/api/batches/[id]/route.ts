import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/api-auth";
import { getBatchWithItems } from "@/lib/server/processing-batches";

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
