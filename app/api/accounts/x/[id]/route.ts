import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Platform } from "@prisma/client";
import { requireApiUser } from "@/lib/server/api-auth";
import { updateXTokens } from "@/lib/server/account-credentials";
import {
  accountDeletionBlockedMessage,
  getAccountDeletionBlocker
} from "@/lib/server/account-deletion-guard";
import { prisma } from "@/lib/server/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  accessToken: z.string().min(1).optional(),
  refreshToken: z.string().optional(),
  oauth1AccessToken: z.string().optional(),
  oauth1AccessTokenSecret: z.string().optional(),
  tokenExpiresAt: z.coerce.date().optional()
});

/** Manuel OAuth2 token guncelleme akisi (reconnect fallback). */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);

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

  try {
    const updated = await updateXTokens(id, {
      accessToken: parsed.data.accessToken,
      refreshToken: parsed.data.refreshToken,
      oauth1AccessToken: parsed.data.oauth1AccessToken,
      oauth1AccessTokenSecret: parsed.data.oauth1AccessTokenSecret,
      tokenExpiresAt: parsed.data.tokenExpiresAt
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    console.error("X account token update failed", error);
    return NextResponse.json(
      { error: "X hesap token bilgileri kaydedilemedi." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const account = await prisma.xAccount.findUnique({ where: { id } });

  if (!account) {
    return NextResponse.json({ error: "Hesap bulunamadi" }, { status: 404 });
  }

  const blocker = await getAccountDeletionBlocker(Platform.X, id);
  if (blocker) {
    return NextResponse.json(
      { error: accountDeletionBlockedMessage(blocker), blocker },
      { status: 409 }
    );
  }

  await prisma.xAccount.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
