import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/server/api-auth";
import { updateCustomSiteApiKey } from "@/lib/server/account-credentials";
import { prisma } from "@/lib/server/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  apiKey: z.string().min(1)
});

export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz veri" }, { status: 400 });
  }

  const site = await prisma.customSite.findUnique({ where: { id } });
  if (!site) {
    return NextResponse.json({ error: "Site bulunamadı" }, { status: 404 });
  }

  const updated = await updateCustomSiteApiKey(id, parsed.data.apiKey);
  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const site = await prisma.customSite.findUnique({ where: { id } });

  if (!site) {
    return NextResponse.json({ error: "Site bulunamadı" }, { status: 404 });
  }

  await prisma.customSite.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
