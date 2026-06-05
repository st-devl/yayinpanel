import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Platform } from "@prisma/client";
import { requireApiUser } from "@/lib/server/api-auth";
import { getActiveProvider } from "@/lib/ai/provider-registry";
import {
  processWebsiteBatch,
  processInstagramBatch,
  processXBatch
} from "@/lib/ai/content-processor";
import { parseFileToText } from "@/lib/ai/file-parser";
import { getEnv } from "@/lib/server/env";
import { logUsage } from "@/lib/server/ai-usage";
import { createBatch, updateBatchStatus } from "@/lib/server/processing-batches";
import { createReviewItem } from "@/lib/server/review-items";
import { getDefaultAIProvider } from "@/lib/server/ai-providers";
import { prisma } from "@/lib/server/prisma";

export const maxDuration = 120;

const MAX_TOTAL_BYTES = 10 * 1024 * 1024; // 10 MB

const requestSchema = z.object({
  platform: z.nativeEnum(Platform),
  accountId: z.string().min(1),
  mediaFileIds: z.array(z.string()).default([]),
  documentFileIds: z.array(z.string()).default([]),
  rawText: z.string().optional(),
  instructionText: z.string().optional(),
  aiProviderId: z.string().optional()
});

export async function POST(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const parsed = requestSchema.safeParse(await request.json());

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Geçersiz istek", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const {
    platform,
    accountId,
    mediaFileIds,
    documentFileIds,
    rawText,
    instructionText,
    aiProviderId
  } = parsed.data;

  if (!rawText && documentFileIds.length === 0) {
    return NextResponse.json(
      { error: "İşlenecek içerik bulunamadı. Dosya yükleyin veya metin girin." },
      { status: 400 }
    );
  }

  const defaultProvider = await getDefaultAIProvider();
  const resolvedProviderId = aiProviderId ?? defaultProvider?.id;

  if (!resolvedProviderId) {
    return NextResponse.json(
      {
        error:
          "Yapay zekâ sağlayıcısı bulunamadı. Lütfen Ayarlar > Yapay Zekâ Sağlayıcıları bölümünden sağlayıcı ekleyin."
      },
      { status: 400 }
    );
  }

  const batch = await createBatch({
    platform,
    accountId,
    aiProviderId: resolvedProviderId,
    instructionText: instructionText ?? null,
    uploadedFileIds: [...mediaFileIds, ...documentFileIds]
  });

  try {
    await updateBatchStatus(batch.id, "PROCESSING");

    // Doküman dosyalarını metin olarak oku
    let combinedText = rawText ?? "";

    if (documentFileIds.length > 0) {
      const mediaFiles = await prisma.mediaFile.findMany({
        where: { id: { in: documentFileIds } }
      });

      let totalBytes = 0;

      for (const file of mediaFiles) {
        totalBytes += file.fileSize;

        if (totalBytes > MAX_TOTAL_BYTES) {
          throw new Error("Toplam dosya boyutu 10 MB sınırını aşıyor.");
        }

        const { readMediaBinary } = await import("@/lib/server/media-storage");
        const binary = await readMediaBinary(file.id);

        if (binary) {
          const text = await parseFileToText(binary.buffer, file.mimeType);
          combinedText += combinedText ? `\n\n---\n\n${text}` : text;
        }
      }
    }

    if (!combinedText.trim()) {
      throw new Error("Dosyalardan metin çıkarılamadı.");
    }

    // Medya dosyası bilgilerini hazırla
    const mediaFiles = mediaFileIds.length
      ? await prisma.mediaFile.findMany({
          where: { id: { in: mediaFileIds } },
          select: { id: true, originalFileName: true }
        })
      : [];

    const mediaFileInfos = mediaFiles.map((f) => ({
      fileId: f.id,
      fileName: f.originalFileName
    }));

    const env = getEnv();
    const provider = await getActiveProvider(resolvedProviderId);

    const processBatchFn =
      platform === Platform.INSTAGRAM
        ? processInstagramBatch
        : platform === Platform.X
          ? processXBatch
          : processWebsiteBatch;

    const result = await processBatchFn({
      rawText: combinedText,
      mediaFiles: mediaFileInfos,
      instructionText: instructionText ?? "",
      accountId,
      timezone: env.TIMEZONE ?? "Europe/Istanbul",
      provider
    });

    // Token kullanımını kaydet
    await logUsage({
      aiProviderId: resolvedProviderId,
      batchId: batch.id,
      model: result.model,
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      purpose: "content_processing"
    });

    // Review item'larını kaydet
    for (const item of result.items) {
      await createReviewItem(batch.id, item);
    }

    const updatedBatch = await updateBatchStatus(batch.id, "REVIEW_PENDING", {
      totalItems: result.items.length
    });

    return NextResponse.json({ data: { batchId: updatedBatch.id } });
  } catch (error) {
    await updateBatchStatus(batch.id, "FAILED", {
      errorMessage:
        error instanceof Error ? error.message : "Bilinmeyen hata"
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "İçerik işleme başarısız"
      },
      { status: 500 }
    );
  }
}
