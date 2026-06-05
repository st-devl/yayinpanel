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
  const result = await deleteStoredMedia(id);

  if (result.reason === "not_found") {
    return NextResponse.json(
      { error: "Media file not found" },
      { status: 404 }
    );
  }

  if (result.reason === "in_use") {
    return NextResponse.json(
      { error: "Media file is used by existing content cards" },
      { status: 409 }
    );
  }

  return NextResponse.json({ deleted: true });
}
