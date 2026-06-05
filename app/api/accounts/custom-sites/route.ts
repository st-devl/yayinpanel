import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/server/api-auth";
import {
  createCustomSite,
  customSiteSafeSelect
} from "@/lib/server/account-credentials";
import { prisma } from "@/lib/server/prisma";

const createSchema = z.object({
  name: z.string().min(1),
  baseUrl: z.string().url(),
  apiKey: z.string().min(1)
});

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const sites = await prisma.customSite.findMany({
    orderBy: { createdAt: "desc" },
    select: customSiteSafeSelect
  });

  return NextResponse.json({ data: sites });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const parsed = createSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz site verisi", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const site = await createCustomSite(parsed.data);
  return NextResponse.json({ data: site }, { status: 201 });
}
