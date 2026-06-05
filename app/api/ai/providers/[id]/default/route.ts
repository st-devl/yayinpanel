import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/api-auth";
import { setDefaultAIProvider } from "@/lib/server/ai-providers";
import { prisma } from "@/lib/server/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const exists = await prisma.aIProvider.findUnique({ where: { id } });

  if (!exists) {
    return NextResponse.json({ error: "Sağlayıcı bulunamadı" }, { status: 404 });
  }

  const updated = await setDefaultAIProvider(id);
  return NextResponse.json({ data: updated });
}
