import "server-only";

import { SHARED_SYSTEM_PROMPT } from "@/lib/ai/prompts/shared";
import { buildWebsitePrompt } from "@/lib/ai/prompts/website";
import { buildInstagramPrompt } from "@/lib/ai/prompts/instagram";
import { buildXPrompt } from "@/lib/ai/prompts/x";
import { parseScheduledAt } from "@/lib/ai/schedule-parser";
import { classifyConfidence } from "@/lib/ai/confidence-classifier";
import type { AIProviderInterface } from "@/lib/ai/provider-interface";
import type { ProcessedContent, MediaAssignment } from "@/lib/ai/types";

type MediaFileInfo = {
  fileId: string;
  fileName: string;
};

type ProcessBatchParams = {
  rawText: string;
  mediaFiles: MediaFileInfo[];
  instructionText: string;
  accountId: string;
  timezone: string;
  provider: AIProviderInterface;
};

type ProcessBatchResult = {
  items: ProcessedContent[];
  inputTokens: number;
  outputTokens: number;
  model: string;
};

export async function processWebsiteBatch(
  params: ProcessBatchParams
): Promise<ProcessBatchResult> {
  const userPrompt = buildWebsitePrompt({
    rawText: params.rawText,
    mediaFiles: params.mediaFiles,
    instructionText: params.instructionText,
    accountId: params.accountId,
    timezone: params.timezone,
    currentDateIso: new Date().toISOString()
  });

  return runProcessing(
    params.provider,
    userPrompt,
    "website",
    params.accountId
  );
}

export async function processInstagramBatch(
  params: ProcessBatchParams
): Promise<ProcessBatchResult> {
  const userPrompt = buildInstagramPrompt({
    rawText: params.rawText,
    mediaFiles: params.mediaFiles,
    instructionText: params.instructionText,
    accountId: params.accountId,
    timezone: params.timezone,
    currentDateIso: new Date().toISOString()
  });

  return runProcessing(
    params.provider,
    userPrompt,
    "instagram",
    params.accountId
  );
}

export async function processXBatch(
  params: ProcessBatchParams
): Promise<ProcessBatchResult> {
  const userPrompt = buildXPrompt({
    rawText: params.rawText,
    mediaFiles: params.mediaFiles,
    instructionText: params.instructionText,
    accountId: params.accountId,
    timezone: params.timezone,
    currentDateIso: new Date().toISOString()
  });

  return runProcessing(params.provider, userPrompt, "x", params.accountId);
}

async function runProcessing(
  provider: AIProviderInterface,
  userPrompt: string,
  platform: "website" | "instagram" | "x",
  accountId: string
): Promise<ProcessBatchResult> {
  const response = await provider.complete(
    [
      { role: "system", content: SHARED_SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    { maxTokens: 8192, temperature: 0.2 }
  );

  const rawItems = parseAIResponse(response.content);

  const items: ProcessedContent[] = rawItems.map((raw) => {
    const confidence =
      typeof raw.confidence === "number" ? raw.confidence : 0.5;
    const warnings: string[] = Array.isArray(raw.warnings) ? raw.warnings : [];
    const media: MediaAssignment[] = Array.isArray(raw.media) ? raw.media : [];
    const scheduledAt = parseScheduledAt(raw.scheduledAt as string | null);
    const title = firstString(raw, ["title"]);
    const summary = firstString(raw, ["summary", "excerpt"]);
    const contentHtml = firstString(raw, ["contentHtml", "content", "body"]);
    const caption = firstString(raw, [
      "caption",
      "text",
      "content",
      "description",
      "body"
    ]);
    const tweetText = firstString(raw, [
      "tweetText",
      "text",
      "content",
      "body",
      "postText",
      "tweet",
      "title"
    ]);

    if (!scheduledAt && !warnings.includes("AMBIGUOUS_SCHEDULE")) {
      warnings.push("AMBIGUOUS_SCHEDULE");
    }

    if (
      platform === "x" &&
      !tweetText &&
      !warnings.includes("MISSING_CONTENT")
    ) {
      warnings.push("MISSING_CONTENT");
    }

    if (
      platform === "instagram" &&
      !caption &&
      !warnings.includes("MISSING_CONTENT")
    ) {
      warnings.push("MISSING_CONTENT");
    }

    return {
      platform,
      contentType:
        (typeof raw.contentType === "string" ? raw.contentType : null) ??
        (platform === "website"
          ? "blog_post"
          : platform === "instagram"
            ? "instagram_post"
            : "x_post"),
      targetAccountId: accountId,
      title,
      summary,
      slug: firstString(raw, ["slug"]),
      contentHtml,
      seoTitle: firstString(raw, ["seoTitle"]),
      seoDescription: firstString(raw, ["seoDescription"]),
      category: firstString(raw, ["category"]),
      tags: Array.isArray(raw.tags) ? (raw.tags as unknown[]).map(String) : [],
      caption,
      hashtags: Array.isArray(raw.hashtags)
        ? (raw.hashtags as unknown[]).map(String)
        : [],
      tweetText,
      threadItems: Array.isArray(raw.threadItems)
        ? (raw.threadItems as unknown[]).map(String)
        : [],
      media,
      scheduledAt,
      scheduleIsInferred: Boolean(raw.scheduleIsInferred),
      confidence,
      confidenceLevel: classifyConfidence(confidence),
      warnings,
      aiNotes: firstString(raw, ["aiNotes"])
    };
  });

  return {
    items,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
    model: response.model
  };
}

function firstString(
  raw: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = raw[key];

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function parseAIResponse(content: string): Record<string, unknown>[] {
  const trimmed = content.trim();

  try {
    const parsed: unknown = JSON.parse(trimmed);

    if (Array.isArray(parsed)) {
      return parsed as Record<string, unknown>[];
    }

    // Bazı modeller { "items": [...] } veya { "result": "[...]" } döndürebilir
    if (typeof parsed === "object" && parsed !== null) {
      const obj = parsed as Record<string, unknown>;

      if (Array.isArray(obj.items))
        return obj.items as Record<string, unknown>[];
      if (Array.isArray(obj.result))
        return obj.result as Record<string, unknown>[];

      // Anthropic tool use: result string olarak gelir
      if (typeof obj.result === "string") {
        const inner: unknown = JSON.parse(obj.result);
        if (Array.isArray(inner)) return inner as Record<string, unknown>[];
      }
    }
  } catch {
    // JSON parse hatası — AI geçersiz JSON döndürdü
  }

  throw new Error(
    "Yapay zekâ geçerli bir JSON çıktısı üretemedi. Lütfen tekrar deneyin."
  );
}
