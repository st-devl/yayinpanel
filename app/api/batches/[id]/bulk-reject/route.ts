import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/server/api-auth";
import { bulkReject } from "@/lib/server/review-items";

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

  await bulkReject(id, parsed.data.itemIds);
  return NextResponse.json({ ok: true });
}
