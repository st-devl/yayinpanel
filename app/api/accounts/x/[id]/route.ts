import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/server/api-auth";
import { updateXTokens } from "@/lib/server/account-credentials";
import { prisma } from "@/lib/server/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  tokenExpiresAt: z.coerce.date().optional()
});

/** Manuel OAuth2 token guncelleme akisi (reconnect fallback). */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Gecersiz token verisi" },
      { status: 400 }
    );
  }

  const account = await prisma.xAccount.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.json({ error: "Hesap bulunamadi" }, { status: 404 });
  }

  const updated = await updateXTokens(id, {
    accessToken: parsed.data.accessToken,
    refreshToken: parsed.data.refreshToken,
    tokenExpiresAt: parsed.data.tokenExpiresAt ?? null
  });

  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const account = await prisma.xAccount.findUnique({ where: { id } });

  if (!account) {
    return NextResponse.json({ error: "Hesap bulunamadi" }, { status: 404 });
  }

  await prisma.xAccount.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
