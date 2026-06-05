import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Platform } from "@prisma/client";
import { requireApiUser } from "@/lib/server/api-auth";
import { updateInstagramAccessToken } from "@/lib/server/account-credentials";
import {
  accountDeletionBlockedMessage,
  getAccountDeletionBlocker
} from "@/lib/server/account-deletion-guard";
import { prisma } from "@/lib/server/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const reconnectSchema = z.object({
  accessToken: z.string().min(1),
  tokenExpiresAt: z.coerce.date().optional()
});

/** Yeni access token ile Instagram hesabini yeniden baglar. */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = reconnectSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Gecersiz token verisi" },
      { status: 400 }
    );
  }

  const account = await prisma.instagramAccount.findUnique({ where: { id } });
  if (!account) {
    return NextResponse.json({ error: "Hesap bulunamadi" }, { status: 404 });
  }

  const updated = await updateInstagramAccessToken(
    id,
    parsed.data.accessToken,
    parsed.data.tokenExpiresAt ?? null
  );

  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const account = await prisma.instagramAccount.findUnique({ where: { id } });

  if (!account) {
    return NextResponse.json({ error: "Hesap bulunamadi" }, { status: 404 });
  }

  const blocker = await getAccountDeletionBlocker(Platform.INSTAGRAM, id);
  if (blocker) {
    return NextResponse.json(
      { error: accountDeletionBlockedMessage(blocker), blocker },
      { status: 409 }
    );
  }

  await prisma.instagramAccount.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
