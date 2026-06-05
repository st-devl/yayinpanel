import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/api-auth";
import { createSignedMediaFileUrl } from "@/lib/server/media-access";
import { prisma } from "@/lib/server/prisma";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  const media = await prisma.mediaFile.findUnique({
    where: { id },
    select: { id: true }
  });

  if (!media) {
    return NextResponse.json(
      { error: "Media file not found" },
      { status: 404 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    expiresInSeconds?: number;
  };
  const expiresInSeconds = Math.min(
    Math.max(Number(body.expiresInSeconds ?? 600) || 600, 60),
    3600
  );
  const signedUrl = createSignedMediaFileUrl(id, expiresInSeconds);

  return NextResponse.json({
    data: {
      expiresAt: signedUrl.expiresAt.toISOString(),
      url: signedUrl.url
    }
  });
}
