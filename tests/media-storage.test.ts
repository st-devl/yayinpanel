import { mkdtemp, mkdir, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  deleteStoredMedia,
  isStoredMediaAvailable,
  readMediaBinary
} from "@/lib/server/media-storage";
import { prisma } from "@/lib/server/prisma";

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    mediaFile: {
      delete: vi.fn(),
      findUnique: vi.fn()
    }
  }
}));

const ORIGINAL_ENV = { ...process.env };
let storageDir: string;

beforeEach(async () => {
  vi.clearAllMocks();
  storageDir = await mkdtemp(path.join(os.tmpdir(), "patlat-media-"));
  process.env = { ...ORIGINAL_ENV };
  process.env.ADMIN_PASSWORD = "short";
  process.env.STORAGE_DIR = storageDir;
});

afterEach(async () => {
  process.env = { ...ORIGINAL_ENV };
  await rm(storageDir, { force: true, recursive: true });
});

async function writeStoredFile(storagePath: string, content: string) {
  const absolutePath = path.join(storageDir, storagePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content);
}

function mediaRecord(storagePath: string) {
  return {
    createdAt: new Date("2026-06-08T10:00:00.000Z"),
    fileName: "image.png",
    fileSize: 5,
    height: 1,
    id: "media-1",
    mimeType: "image/png",
    originalFileName: "image.png",
    storagePath,
    storageType: "LOCAL",
    updatedAt: new Date("2026-06-08T10:00:00.000Z"),
    width: 1
  };
}

describe("media storage", () => {
  it("reads media from STORAGE_DIR without validating unrelated env", async () => {
    await writeStoredFile("media/2026/06/image.png", "image");
    vi.mocked(prisma.mediaFile.findUnique).mockResolvedValue(
      mediaRecord("media/2026/06/image.png")
    );

    const media = await readMediaBinary("media-1");

    expect(media?.buffer.toString()).toBe("image");
    expect(media?.mimeType).toBe("image/png");
  });

  it("treats stale database rows with missing files as unavailable", async () => {
    vi.mocked(prisma.mediaFile.findUnique).mockResolvedValue(
      mediaRecord("media/2026/06/missing.png")
    );

    await expect(readMediaBinary("media-1")).resolves.toBeNull();
    await expect(
      isStoredMediaAvailable({ storagePath: "media/2026/06/missing.png" })
    ).resolves.toBe(false);
  });

  it("deletes media records even when existing cards reference them", async () => {
    await writeStoredFile("media/2026/06/used.png", "image");
    vi.mocked(prisma.mediaFile.findUnique).mockResolvedValue(
      mediaRecord("media/2026/06/used.png")
    );
    vi.mocked(prisma.mediaFile.delete).mockResolvedValue(
      mediaRecord("media/2026/06/used.png")
    );

    await expect(deleteStoredMedia("media-1")).resolves.toEqual({
      deleted: true,
      reason: null
    });
    expect(prisma.mediaFile.delete).toHaveBeenCalledWith({
      where: { id: "media-1" }
    });
    await expect(
      isStoredMediaAvailable({ storagePath: "media/2026/06/used.png" })
    ).resolves.toBe(false);
  });
});
