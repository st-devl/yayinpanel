import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/lib/server/api-auth";
import {
  createXAccount,
  xAccountSafeSelect
} from "@/lib/server/account-credentials";
import { prisma } from "@/lib/server/prisma";

const createSchema = z.object({
  accountName: z.string().min(1),
  username: z.string().min(1),
  xUserId: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  profileImageUrl: z.string().url().optional(),
  tokenExpiresAt: z.coerce.date().optional()
});

export async function GET() {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const accounts = await prisma.xAccount.findMany({
    orderBy: { createdAt: "desc" },
    select: xAccountSafeSelect
  });

  return NextResponse.json({ data: accounts });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const parsed = createSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Gecersiz hesap verisi", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const account = await createXAccount(parsed.data);
  return NextResponse.json({ data: account }, { status: 201 });
}
