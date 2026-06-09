import "server-only";

import { randomUUID } from "crypto";
import { access, mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import sharp from "sharp";
import { prisma } from "@/lib/server/prisma";
import { getStorageDir } from "@/lib/server/env";

const maxImageFileSize = 20 * 1024 * 1024;
const maxDocumentFileSize = 20 * 1024 * 1024;
const minAspectRatio = 0.25;
const maxAspectRatio = 4;
const allowedFormats = new Set(["jpeg", "png", "webp"]);

const allowedDocumentMimeTypes = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/pdf",
  "text/markdown",
  "text/plain",
  "text/x-markdown"
]);

const documentExtensionsByMimeType: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/pdf": "pdf",
  "text/markdown": "md",
  "text/plain": "txt",
  "text/x-markdown": "md"
};

export function isDocumentMimeType(mimeType: string) {
  return allowedDocumentMimeTypes.has(mimeType);
}

const mimeTypesByFormat: Record<string, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp"
};

const extensionsByFormat: Record<string, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp"
};

export class MediaValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaValidationError";
  }
}

export type StoreUploadedMediaInput = {
  buffer: Buffer;
  mimeType: string;
  originalFileName: string;
};

function getStorageRoot() {
  return path.resolve(
    /*turbopackIgnore: true*/ process.cwd(),
    getStorageDir()
  );
}

function resolveStoragePath(storagePath: string) {
  const root = getStorageRoot();
  const resolved = path.resolve(/*turbopackIgnore: true*/ root, storagePath);

  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error("Storage path is outside of the configured storage root");
  }

  return resolved;
}

function sanitizeOriginalFileName(fileName: string) {
  const sanitized = path
    .basename(fileName || "upload")
    .replace(/[^\w.\- ]+/g, "_")
    .trim()
    .slice(0, 120);

  return sanitized || "upload";
}

function buildRelativeStoragePath(fileName: string) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return path.posix.join("media", year, month, fileName);
}

async function validateImageBuffer(buffer: Buffer) {
  if (buffer.byteLength < 1) {
    throw new MediaValidationError("Uploaded media file is empty");
  }

  if (buffer.byteLength > maxImageFileSize) {
    throw new MediaValidationError("Uploaded media file exceeds 20MB");
  }

  const metadata = await sharp(buffer, {
    limitInputPixels: 50_000_000
  }).metadata();
  const format = metadata.format;

  if (!format || !allowedFormats.has(format)) {
    throw new MediaValidationError(
      "Only JPG, PNG and WEBP images are supported"
    );
  }

  if (!metadata.width || !metadata.height) {
    throw new MediaValidationError(
      "Image width and height could not be detected"
    );
  }

  const aspectRatio = metadata.width / metadata.height;

  if (aspectRatio < minAspectRatio || aspectRatio > maxAspectRatio) {
    throw new MediaValidationError(
      "Image aspect ratio must be between 1:4 and 4:1"
    );
  }

  return {
    extension: extensionsByFormat[format],
    height: metadata.height,
    mimeType: mimeTypesByFormat[format],
    width: metadata.width
  };
}

export async function storeUploadedDocument(input: StoreUploadedMediaInput) {
  const mimeType = input.mimeType;

  if (!allowedDocumentMimeTypes.has(mimeType)) {
    throw new MediaValidationError(
      "Only DOCX, PDF, Markdown and plain text files are supported"
    );
  }

  if (input.buffer.byteLength < 1) {
    throw new MediaValidationError("Uploaded file is empty");
  }

  if (input.buffer.byteLength > maxDocumentFileSize) {
    throw new MediaValidationError("Uploaded file exceeds 20MB");
  }

  const id = randomUUID();
  const extension = documentExtensionsByMimeType[mimeType] ?? "bin";
  const fileName = `${id}.${extension}`;
  const originalFileName = sanitizeOriginalFileName(input.originalFileName);
  const storagePath = buildRelativeStoragePath(fileName);
  const absolutePath = resolveStoragePath(storagePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.buffer);

  try {
    return await prisma.mediaFile.create({
      data: {
        id,
        fileName,
        originalFileName,
        mimeType,
        fileSize: input.buffer.byteLength,
        width: null,
        height: null,
        storageType: "LOCAL",
        storagePath
      }
    });
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }
}

export async function storeUploadedMedia(input: StoreUploadedMediaInput) {
  const metadata = await validateImageBuffer(input.buffer);
  const id = randomUUID();
  const fileName = `${id}.${metadata.extension}`;
  const originalFileName = sanitizeOriginalFileName(input.originalFileName);
  const storagePath = buildRelativeStoragePath(fileName);
  const absolutePath = resolveStoragePath(storagePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, input.buffer);

  try {
    return await prisma.mediaFile.create({
      data: {
        id,
        fileName,
        originalFileName,
        mimeType: metadata.mimeType,
        fileSize: input.buffer.byteLength,
        width: metadata.width,
        height: metadata.height,
        storageType: "LOCAL",
        storagePath
      }
    });
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }
}

export async function readMediaBinary(mediaId: string) {
  const media = await prisma.mediaFile.findUnique({
    where: { id: mediaId }
  });

  if (!media) {
    return null;
  }

  const absolutePath = resolveStoragePath(media.storagePath);
  let buffer: Buffer;

  try {
    buffer = await readFile(absolutePath);
  } catch (error) {
    if (isMissingFileError(error)) {
      return null;
    }

    throw error;
  }

  return {
    buffer,
    fileName: media.originalFileName,
    fileSize: media.fileSize,
    mimeType: media.mimeType,
    storagePath: media.storagePath
  };
}

export async function getMediaFileForWordPressUpload(mediaId: string) {
  return readMediaBinary(mediaId);
}

export async function isStoredMediaAvailable(media: { storagePath: string }) {
  try {
    await access(resolveStoragePath(media.storagePath));
    return true;
  } catch {
    return false;
  }
}

export async function deleteStoredMedia(mediaId: string) {
  const media = await prisma.mediaFile.findUnique({
    where: { id: mediaId }
  });

  if (!media) {
    return { deleted: false, reason: "not_found" as const };
  }

  await prisma.mediaFile.delete({ where: { id: mediaId } });
  await unlink(resolveStoragePath(media.storagePath)).catch(() => undefined);

  return { deleted: true, reason: null };
}

function isMissingFileError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
