import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/api-auth";
import { deleteStoredMedia } from "@/lib/server/media-storage";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const auth = await requireApiUser();

  if (auth.response) {
    return auth.response;
  }

  const { id } = await context.params;
  let result: Awaited<ReturnType<typeof deleteStoredMedia>>;

  try {
    result = await deleteStoredMedia(id);
  } catch (error) {
    console.error("Media delete failed", error);
    return NextResponse.json(
      { error: "Medya silinirken sunucu hatasi olustu." },
      { status: 500 }
    );
  }

  if (result.reason === "not_found") {
    return NextResponse.json(
      { error: "Media file not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ deleted: true });
}
