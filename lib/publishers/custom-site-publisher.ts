import "server-only";

import { Platform } from "@prisma/client";
import { customSitePlatformDataSchema } from "@/lib/domain/platform-data";
import { classifyHttpStatus, permanentError } from "@/lib/publishers/errors";
import { fetchWithTimeout, readJsonResponse } from "@/lib/publishers/http";
import type {
  PublishContext,
  PublishResult,
  Publisher
} from "@/lib/publishers/types";

export class CustomSitePublisher implements Publisher {
  readonly platform = Platform.CUSTOM_SITE;

  async publish(context: PublishContext): Promise<PublishResult> {
    const site = context.credentials.customSite;

    if (!site) {
      throw permanentError(
        "CUSTOM_SITE_MISSING",
        "Özel site kimlik bilgileri eksik"
      );
    }

    const platformData = customSitePlatformDataSchema.parse(
      context.card.platformData ?? {}
    );
    const baseUrl = site.baseUrl.replace(/\/+$/, "");

    let featuredImageUrl: string | undefined;

    if (context.buildSignedMediaUrl) {
      const url = await context.buildSignedMediaUrl();
      featuredImageUrl = url ?? undefined;
    }

    const body: Record<string, unknown> = {
      title: platformData.title,
      content: platformData.contentHtml,
      publishStatus: platformData.publishStatus
    };

    if (platformData.slug) body.slug = platformData.slug;
    if (platformData.excerpt) body.excerpt = platformData.excerpt;
    if (platformData.seoTitle) body.seoTitle = platformData.seoTitle;
    if (platformData.seoDescription) body.seoDescription = platformData.seoDescription;
    if (platformData.categories.length > 0) body.categories = platformData.categories;
    if (platformData.tags.length > 0) body.tags = platformData.tags;
    if (featuredImageUrl) body.featuredImageUrl = featuredImageUrl;
    if (platformData.extra) body.extra = platformData.extra;

    const response = await fetchWithTimeout(`${baseUrl}/api/patlat/publish`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${site.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const result = await readJsonResponse(response);

    if (!result.ok) {
      throw classifyHttpStatus(
        result.status,
        "CUSTOM_SITE_PUBLISH_FAILED",
        customSiteErrorMessage(result.json, "Özel site yayını başarısız"),
        result.json
      );
    }

    const post = result.json as { id?: string | number; url?: string };

    if (!post?.id) {
      throw permanentError(
        "CUSTOM_SITE_NO_ID",
        "Özel siteden post id alınamadı",
        { apiResponse: result.json }
      );
    }

    return {
      status: "PUBLISHED",
      externalPostId: String(post.id),
      externalPostUrl: post.url ?? null,
      apiResponse: { id: post.id }
    };
  }
}

function customSiteErrorMessage(json: unknown, fallback: string): string {
  const body = json as { message?: string; error?: string };
  return body?.message ?? body?.error ?? fallback;
}
