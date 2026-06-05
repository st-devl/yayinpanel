import "server-only";

import { Platform } from "@prisma/client";
import { instagramPlatformDataSchema } from "@/lib/domain/platform-data";
import { classifyHttpStatus, permanentError } from "@/lib/publishers/errors";
import { fetchWithTimeout, readJsonResponse } from "@/lib/publishers/http";
import type {
  PublishContext,
  PublishResult,
  Publisher
} from "@/lib/publishers/types";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

type GraphErrorBody = {
  error?: { message?: string; code?: number; error_subcode?: number };
};

function graphErrorMessage(json: unknown, fallback: string) {
  const body = json as GraphErrorBody;
  return body?.error?.message ?? fallback;
}

/**
 * Instagram Graph API publisher.
 * Akis: media container olustur -> status kontrol -> publish.
 */
export class InstagramPublisher implements Publisher {
  readonly platform = Platform.INSTAGRAM;

  async publish(context: PublishContext): Promise<PublishResult> {
    const { credentials } = context;
    const igUserId = credentials.instagramBusinessAccountId;

    if (!igUserId) {
      throw permanentError(
        "IG_MISSING_BUSINESS_ID",
        "Instagram business account id eksik"
      );
    }

    if (!context.buildSignedMediaUrl) {
      throw permanentError(
        "IG_MISSING_MEDIA",
        "Instagram gonderileri icin gorsel zorunludur"
      );
    }

    const imageUrl = await context.buildSignedMediaUrl();

    if (!imageUrl) {
      throw permanentError(
        "IG_MISSING_MEDIA",
        "Instagram gonderileri icin gorsel zorunludur"
      );
    }

    const platformData = instagramPlatformDataSchema.parse(
      context.card.platformData ?? {}
    );
    const caption = buildCaption(context.card.text, platformData.hashtags);

    const containerId = await this.createContainer(
      igUserId,
      credentials.accessToken,
      imageUrl,
      caption
    );

    await this.waitForContainerReady(containerId, credentials.accessToken);

    const mediaId = await this.publishContainer(
      igUserId,
      credentials.accessToken,
      containerId
    );

    return {
      status: "PUBLISHED",
      externalPostId: mediaId,
      externalPostUrl: `https://www.instagram.com/p/${mediaId}/`,
      apiResponse: { mediaId, containerId }
    };
  }

  private async createContainer(
    igUserId: string,
    accessToken: string,
    imageUrl: string,
    caption: string
  ): Promise<string> {
    const params = new URLSearchParams({
      image_url: imageUrl,
      caption,
      access_token: accessToken
    });

    const response = await fetchWithTimeout(`${GRAPH_BASE}/${igUserId}/media`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString()
    });
    const result = await readJsonResponse(response);

    if (!result.ok) {
      throw classifyHttpStatus(
        result.status,
        "IG_CONTAINER_FAILED",
        graphErrorMessage(
          result.json,
          "Instagram media container olusturulamadi"
        ),
        result.json
      );
    }

    const id = (result.json as { id?: string })?.id;

    if (!id) {
      throw permanentError(
        "IG_CONTAINER_NO_ID",
        "Instagram container id alinamadi",
        { apiResponse: result.json }
      );
    }

    return id;
  }

  private async waitForContainerReady(
    containerId: string,
    accessToken: string,
    maxAttempts = 10
  ): Promise<void> {
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const params = new URLSearchParams({
        fields: "status_code,status",
        access_token: accessToken
      });
      const response = await fetchWithTimeout(
        `${GRAPH_BASE}/${containerId}?${params.toString()}`
      );
      const result = await readJsonResponse(response);

      if (!result.ok) {
        throw classifyHttpStatus(
          result.status,
          "IG_STATUS_FAILED",
          graphErrorMessage(
            result.json,
            "Instagram container durumu okunamadi"
          ),
          result.json
        );
      }

      const statusCode = (result.json as { status_code?: string })?.status_code;

      if (statusCode === "FINISHED") {
        return;
      }

      if (statusCode === "ERROR" || statusCode === "EXPIRED") {
        throw permanentError(
          "IG_CONTAINER_ERROR",
          `Instagram container durumu: ${statusCode}`,
          { apiResponse: result.json }
        );
      }

      await delay(2000);
    }

    throw permanentError(
      "IG_CONTAINER_TIMEOUT",
      "Instagram container hazir hale gelmedi"
    );
  }

  private async publishContainer(
    igUserId: string,
    accessToken: string,
    containerId: string
  ): Promise<string> {
    const params = new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken
    });
    const response = await fetchWithTimeout(
      `${GRAPH_BASE}/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString()
      }
    );
    const result = await readJsonResponse(response);

    if (!result.ok) {
      throw classifyHttpStatus(
        result.status,
        "IG_PUBLISH_FAILED",
        graphErrorMessage(result.json, "Instagram gonderi yayinlanamadi"),
        result.json
      );
    }

    const id = (result.json as { id?: string })?.id;

    if (!id) {
      throw permanentError(
        "IG_PUBLISH_NO_ID",
        "Instagram gonderi id alinamadi",
        {
          apiResponse: result.json
        }
      );
    }

    return id;
  }
}

function buildCaption(text: string | null, hashtags: string[]): string {
  const base = (text ?? "").trim();
  const tags = hashtags
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .join(" ");

  return [base, tags].filter(Boolean).join("\n\n");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
