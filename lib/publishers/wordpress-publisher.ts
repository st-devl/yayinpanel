import "server-only";

import { Platform } from "@prisma/client";
import { wordpressPlatformDataSchema } from "@/lib/domain/platform-data";
import { classifyHttpStatus, permanentError } from "@/lib/publishers/errors";
import { fetchWithTimeout, readJsonResponse } from "@/lib/publishers/http";
import type {
  PublishContext,
  PublishResult,
  Publisher
} from "@/lib/publishers/types";

/**
 * WordPress publisher (REST API + Application Password).
 * Akis: (opsiyonel) featured image binary upload -> post olustur (publish).
 */
export class WordPressPublisher implements Publisher {
  readonly platform = Platform.WORDPRESS;

  async publish(context: PublishContext): Promise<PublishResult> {
    const site = context.credentials.wordpress;

    if (!site) {
      throw permanentError(
        "WP_MISSING_SITE",
        "WordPress site kimlik bilgileri eksik"
      );
    }

    const platformData = wordpressPlatformDataSchema.parse(
      context.card.platformData ?? {}
    );
    const authHeader = buildBasicAuth(site.username, site.applicationPassword);
    const baseUrl = site.baseUrl.replace(/\/+$/, "");

    let featuredMediaId: number | undefined;

    if (context.card.mediaFileId && context.loadMedia) {
      const media = await context.loadMedia();

      if (media) {
        featuredMediaId = await this.uploadMedia(baseUrl, authHeader, media);
      }
    }

    const postBody: Record<string, unknown> = {
      title: platformData.title,
      slug: platformData.slug,
      content: platformData.contentHtml,
      excerpt: platformData.excerpt ?? "",
      status: platformData.publishStatus,
      categories: platformData.categoryIds,
      tags: platformData.tagIds
    };

    if (featuredMediaId) {
      postBody.featured_media = featuredMediaId;
    }

    const response = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/posts`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(postBody)
    });
    const result = await readJsonResponse(response);

    if (!result.ok) {
      throw classifyHttpStatus(
        result.status,
        "WP_POST_FAILED",
        wpErrorMessage(result.json, "WordPress gonderisi olusturulamadi"),
        result.json
      );
    }

    const post = result.json as { id?: number; link?: string };

    if (!post?.id) {
      throw permanentError("WP_POST_NO_ID", "WordPress post id alinamadi", {
        apiResponse: result.json
      });
    }

    return {
      status: "PUBLISHED",
      externalPostId: String(post.id),
      externalPostUrl: post.link ?? `${baseUrl}/?p=${post.id}`,
      apiResponse: { id: post.id }
    };
  }

  private async uploadMedia(
    baseUrl: string,
    authHeader: string,
    media: { buffer: Buffer; mimeType: string; fileName: string }
  ): Promise<number> {
    const response = await fetchWithTimeout(`${baseUrl}/wp-json/wp/v2/media`, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": media.mimeType,
        "Content-Disposition": `attachment; filename="${media.fileName}"`
      },
      body: new Uint8Array(media.buffer)
    });
    const result = await readJsonResponse(response);

    if (!result.ok) {
      throw classifyHttpStatus(
        result.status,
        "WP_MEDIA_FAILED",
        wpErrorMessage(result.json, "WordPress medya yuklemesi basarisiz"),
        result.json
      );
    }

    const id = (result.json as { id?: number })?.id;

    if (!id) {
      throw permanentError("WP_MEDIA_NO_ID", "WordPress medya id alinamadi", {
        apiResponse: result.json
      });
    }

    return id;
  }
}

export function buildBasicAuth(username: string, applicationPassword: string) {
  const token = Buffer.from(
    `${username}:${applicationPassword.replace(/\s+/g, "")}`
  ).toString("base64");

  return `Basic ${token}`;
}

function wpErrorMessage(json: unknown, fallback: string): string {
  const body = json as { message?: string };
  return body?.message ?? fallback;
}
