import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/server/api-auth";
import {
  isDocumentMimeType,
  isStoredMediaAvailable,
  MediaValidationError,
  storeUploadedDocument,
  storeUploadedMedia
} from "@/lib/server/media-storage";
import { prisma } from "@/lib/server/prisma";

async function serializeMediaFile<
  T extends {
    _count?: { contentCards: number };
    createdAt: Date;
    storagePath: string;
    updatedAt: Date;
  }
>(media: T) {
  return {
    ...media,
    createdAt: media.createdAt.toISOString(),
    fileAvailable: await isStoredMediaAvailable(media),
    updatedAt: media.updatedAt.toISOString(),
    usedByContentCards: media._count?.contentCards ?? 0,
    _count: undefined
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();

  if (auth.response) {
    return auth.response;
  }

  const { searchParams } = request.nextUrl;
  const query = searchParams.get("q")?.trim();
  const mimeType = searchParams.get("mimeType")?.trim();
  const take = Math.min(Number(searchParams.get("take") ?? 50) || 50, 100);

  const mediaFiles = await prisma.mediaFile.findMany({
    where: {
      originalFileName: query ? { contains: query } : undefined,
      mimeType: mimeType ? { startsWith: mimeType } : undefined
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      _count: {
        select: { contentCards: true }
      }
    }
  });

  return NextResponse.json({
    data: await Promise.all(mediaFiles.map(serializeMediaFile))
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();

  if (auth.response) {
    return auth.response;
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "A file field named 'file' is required" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storeInput = { buffer, mimeType: file.type, originalFileName: file.name };
    const media = isDocumentMimeType(file.type)
      ? await storeUploadedDocument(storeInput)
      : await storeUploadedMedia(storeInput);

    return NextResponse.json(
      { data: await serializeMediaFile(media) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof MediaValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error("Media upload failed", error);
    return NextResponse.json(
      { error: "Medya yuklenirken sunucu hatasi olustu." },
      { status: 500 }
    );
  }
}
