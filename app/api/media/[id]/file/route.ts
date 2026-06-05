import { NextRequest, NextResponse } from "next/server";
import { verifyMediaAccessToken } from "@/lib/server/media-access";
import { getCurrentUser } from "@/lib/server/session";
import { readMediaBinary } from "@/lib/server/media-storage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  const token = request.nextUrl.searchParams.get("token");

  if (!user && !verifyMediaAccessToken(id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const media = await readMediaBinary(id);

  if (!media) {
    return NextResponse.json(
      { error: "Media file not found" },
      { status: 404 }
    );
  }

  return new NextResponse(media.buffer, {
    headers: {
      "Cache-Control": token ? "public, max-age=60" : "private, max-age=60",
      "Content-Disposition": `inline; filename="${media.fileName.replaceAll('"', "")}"`,
      "Content-Length": media.fileSize.toString(),
      "Content-Type": media.mimeType
    }
  });
}
