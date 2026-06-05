import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/server/api-auth";
import { validateFieldMappingJson } from "@/lib/ai/field-mapper";
import { prisma } from "@/lib/server/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const putSchema = z.object({
  mapping: z.record(z.string(), z.string())
});

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const site = await prisma.customSite.findUnique({
    where: { id },
    select: { fieldMappingJson: true }
  });

  if (!site) {
    return NextResponse.json({ error: "Site bulunamadı" }, { status: 404 });
  }

  const mapping = site.fieldMappingJson
    ? (JSON.parse(site.fieldMappingJson) as Record<string, string>)
    : {};

  return NextResponse.json({ data: mapping });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = putSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz eşleştirme verisi" },
      { status: 400 }
    );
  }

  const json = JSON.stringify(parsed.data.mapping);

  if (!validateFieldMappingJson(json)) {
    return NextResponse.json(
      { error: "Alan eşleştirme formatı geçersiz" },
      { status: 400 }
    );
  }

  const site = await prisma.customSite.findUnique({ where: { id } });

  if (!site) {
    return NextResponse.json({ error: "Site bulunamadı" }, { status: 404 });
  }

  await prisma.customSite.update({
    where: { id },
    data: { fieldMappingJson: json }
  });

  return NextResponse.json({ data: parsed.data.mapping });
}
