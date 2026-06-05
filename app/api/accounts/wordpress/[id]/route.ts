import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Platform } from "@prisma/client";
import { requireApiUser } from "@/lib/server/api-auth";
import { updateWordPressApplicationPassword } from "@/lib/server/account-credentials";
import {
  accountDeletionBlockedMessage,
  getAccountDeletionBlocker
} from "@/lib/server/account-deletion-guard";
import { prisma } from "@/lib/server/prisma";

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  applicationPassword: z.string().min(1)
});

/** Application password gunceller (reconnect). */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const parsed = updateSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json({ error: "Gecersiz veri" }, { status: 400 });
  }

  const site = await prisma.wordPressSite.findUnique({ where: { id } });
  if (!site) {
    return NextResponse.json({ error: "Site bulunamadi" }, { status: 404 });
  }

  const updated = await updateWordPressApplicationPassword(
    id,
    parsed.data.applicationPassword
  );

  return NextResponse.json({ data: updated });
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { id } = await context.params;
  const site = await prisma.wordPressSite.findUnique({ where: { id } });

  if (!site) {
    return NextResponse.json({ error: "Site bulunamadi" }, { status: 404 });
  }

  const blocker = await getAccountDeletionBlocker(Platform.WORDPRESS, id);
  if (blocker) {
    return NextResponse.json(
      { error: accountDeletionBlockedMessage(blocker), blocker },
      { status: 409 }
    );
  }

  await prisma.wordPressSite.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
