import "server-only";

import { Platform } from "@prisma/client";
import { classifyHttpStatus, permanentError } from "@/lib/publishers/errors";
import { fetchWithTimeout, readJsonResponse } from "@/lib/publishers/http";
import type {
  PublishContext,
  PublishResult,
  Publisher
} from "@/lib/publishers/types";

const X_API_BASE = "https://api.twitter.com/2";
const X_UPLOAD_BASE = "https://upload.twitter.com/1.1";

/**
 * X (Twitter) publisher.
 * Akis: (opsiyonel) medya upload -> tweet olustur.
 */
export class XPublisher implements Publisher {
  readonly platform = Platform.X;

  async publish(context: PublishContext): Promise<PublishResult> {
    const text = (context.card.text ?? "").trim();

    if (!text) {
      throw permanentError("X_EMPTY_TEXT", "Tweet metni bos olamaz");
    }

    const mediaIds: string[] = [];

    if (context.card.mediaFileId && context.loadMedia) {
      const media = await context.loadMedia();

      if (media) {
        mediaIds.push(
          await this.uploadMedia(context.credentials.accessToken, media)
        );
      }
    }

    const tweetId = await this.createTweet(
      context.credentials.accessToken,
      text,
      mediaIds
    );
    const username = "i";

    return {
      status: "PUBLISHED",
      externalPostId: tweetId,
      externalPostUrl: `https://x.com/${username}/status/${tweetId}`,
      apiResponse: { tweetId, mediaIds }
    };
  }

  private async uploadMedia(
    accessToken: string,
    media: { buffer: Buffer; mimeType: string }
  ): Promise<string> {
    const form = new FormData();
    form.append(
      "media",
      new Blob([new Uint8Array(media.buffer)], { type: media.mimeType })
    );

    const response = await fetchWithTimeout(
      `${X_UPLOAD_BASE}/media/upload.json`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form
      }
    );
    const result = await readJsonResponse(response);

    if (!result.ok) {
      throw classifyHttpStatus(
        result.status,
        "X_MEDIA_UPLOAD_FAILED",
        "X medya yuklemesi basarisiz",
        result.json
      );
    }

    const mediaIdString = (result.json as { media_id_string?: string })
      ?.media_id_string;

    if (!mediaIdString) {
      throw permanentError("X_MEDIA_NO_ID", "X medya id alinamadi", {
        apiResponse: result.json
      });
    }

    return mediaIdString;
  }

  private async createTweet(
    accessToken: string,
    text: string,
    mediaIds: string[]
  ): Promise<string> {
    const body: Record<string, unknown> = { text };

    if (mediaIds.length > 0) {
      body.media = { media_ids: mediaIds };
    }

    const response = await fetchWithTimeout(`${X_API_BASE}/tweets`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const result = await readJsonResponse(response);

    if (!result.ok) {
      throw classifyHttpStatus(
        result.status,
        "X_TWEET_FAILED",
        tweetErrorMessage(result.json),
        result.json
      );
    }

    const id = (result.json as { data?: { id?: string } })?.data?.id;

    if (!id) {
      throw permanentError("X_TWEET_NO_ID", "Tweet id alinamadi", {
        apiResponse: result.json
      });
    }

    return id;
  }
}

function tweetErrorMessage(json: unknown): string {
  const body = json as {
    detail?: string;
    title?: string;
    errors?: Array<{ message?: string }>;
  };

  return (
    body?.detail ??
    body?.errors?.[0]?.message ??
    body?.title ??
    "Tweet olusturulamadi"
  );
}
