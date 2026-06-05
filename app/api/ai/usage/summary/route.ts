import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/api-auth";
import { getMonthlyUsageSummary } from "@/lib/server/ai-usage";
import { prisma } from "@/lib/server/prisma";

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const now = new Date();
  const defaultProvider = await prisma.aIProvider.findFirst({
    where: { isDefault: true },
    select: { id: true }
  });

  if (!defaultProvider) {
    return NextResponse.json({ data: null });
  }

  const summary = await getMonthlyUsageSummary(
    defaultProvider.id,
    now.getFullYear(),
    now.getMonth() + 1
  );

  return NextResponse.json({ data: summary });
}
