import "server-only";

import { Platform } from "@prisma/client";
import { buildOAuth1AuthorizationHeader } from "@/lib/integrations/oauth1";
import { classifyHttpStatus, permanentError } from "@/lib/publishers/errors";
import { fetchWithTimeout, readJsonResponse } from "@/lib/publishers/http";
import { getEnv } from "@/lib/server/env";
import type {
  PublishCredentials,
  PublishContext,
  PublishMedia,
  PublishResult,
  Publisher
} from "@/lib/publishers/types";

const X_API_BASE = "https://api.x.com/2";
const X_V1_MEDIA_UPLOAD_URL =
  "https://upload.twitter.com/1.1/media/upload.json";

const X_TWEET_PERMISSION_MESSAGE =
  "X gönderim izni reddedildi. X Developer Portal'da uygulama izinlerini Read and write yapın; ardından hesabı tweet.write/users.read kapsamlarıyla yeniden bağlayın.";
const X_MEDIA_PERMISSION_MESSAGE =
  "X medya yükleme izni reddedildi. X Developer Portal'da uygulama izinlerini Read and write yapın; ardından hesabı media.write kapsamıyla yeniden bağlayın.";

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
        mediaIds.push(await this.uploadMedia(context.credentials, media));
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
    credentials: PublishCredentials,
    media: PublishMedia
  ): Promise<string> {
    const mediaCategory = mediaCategoryForMimeType(media.mimeType);

    if (!mediaCategory) {
      throw permanentError(
        "X_UNSUPPORTED_MEDIA_TYPE",
        "X yalnizca JPG, PNG ve WEBP gorselleri destekler"
      );
    }

    const form = buildMediaForm(media, mediaCategory);

    const response = await fetchWithTimeout(`${X_API_BASE}/media/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${credentials.accessToken}` },
      body: form
    });
    const result = await readJsonResponse(response);

    if (!result.ok) {
      // OAuth2 (Bearer) ile v2 medya yukleme auth/izin hatasi donerse (401
      // "Unauthorized" veya 403), bu hesap/uygulama icin OAuth2 medya yukleme
      // kullanilamiyor demektir; OAuth1 v1.1 fallback'ine gec. v2 medya ucu pek
      // cok uygulama icin 401 dondurur, bu nedenle 403 ile birlikte 401'i de
      // fallback sinyali sayiyoruz.
      if (
        result.status === 401 ||
        isXPermissionFailure(result.status, result.json)
      ) {
        return this.uploadMediaWithOAuth1Fallback(
          credentials,
          media,
          mediaCategory,
          result
        );
      }

      throw classifyHttpStatus(
        result.status,
        "X_MEDIA_UPLOAD_FAILED",
        xMediaErrorMessage(result.status, result.json),
        result.json
      );
    }

    const body = result.json as {
      data?: { id?: string };
      media_id_string?: string;
    };
    const mediaIdString = body?.data?.id ?? body?.media_id_string;

    if (!mediaIdString) {
      throw permanentError("X_MEDIA_NO_ID", "X medya id alinamadi", {
        apiResponse: result.json
      });
    }

    return mediaIdString;
  }

  private async uploadMediaWithOAuth1Fallback(
    credentials: PublishCredentials,
    media: PublishMedia,
    mediaCategory: "tweet_image",
    oauth2Result: Awaited<ReturnType<typeof readJsonResponse>>
  ): Promise<string> {
    const env = getEnv();

    if (!credentials.xOAuth1?.accessToken || !credentials.xOAuth1.accessTokenSecret) {
      throw classifyHttpStatus(
        oauth2Result.status,
        "X_MEDIA_UPLOAD_FAILED",
        "X medya yükleme izni reddedildi. OAuth2 media.write bu X uygulamasında/grant ekranında yoksa Hesap Bağlantıları > X hesabı > Yenile bölümüne OAuth1 Access Token ve Access Token Secret ekleyin.",
        oauth2Result.json
      );
    }

    if (!env.X_API_KEY || !env.X_API_SECRET) {
      throw permanentError(
        "X_MEDIA_OAUTH1_CONFIG_MISSING",
        "X medya yükleme için X_API_KEY ve X_API_SECRET sunucu ortamında tanımlı olmalı"
      );
    }

    const response = await fetchWithTimeout(X_V1_MEDIA_UPLOAD_URL, {
      method: "POST",
      headers: {
        Authorization: buildOAuth1AuthorizationHeader({
          consumerKey: env.X_API_KEY,
          consumerSecret: env.X_API_SECRET,
          method: "POST",
          token: credentials.xOAuth1.accessToken,
          tokenSecret: credentials.xOAuth1.accessTokenSecret,
          url: X_V1_MEDIA_UPLOAD_URL
        })
      },
      body: buildMediaForm(media, mediaCategory)
    });
    const result = await readJsonResponse(response);

    if (!result.ok) {
      throw classifyHttpStatus(
        result.status,
        "X_MEDIA_UPLOAD_FAILED",
        xOAuth1MediaErrorMessage(result.status, result.json),
        result.json
      );
    }

    const body = result.json as {
      media_id_string?: string;
      media_id?: number | string;
    };
    const mediaIdString = body.media_id_string ?? body.media_id?.toString();

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
        tweetErrorMessage(result.status, result.json),
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

function tweetErrorMessage(status: number, json: unknown): string {
  if (isXPermissionFailure(status, json)) {
    return X_TWEET_PERMISSION_MESSAGE;
  }

  return xErrorMessage(json, "Tweet olusturulamadi");
}

function xMediaErrorMessage(status: number, json: unknown): string {
  if (isXPermissionFailure(status, json)) {
    return X_MEDIA_PERMISSION_MESSAGE;
  }

  return xErrorMessage(json, "X medya yuklemesi basarisiz");
}

function xOAuth1MediaErrorMessage(status: number, json: unknown): string {
  if (isXPermissionFailure(status, json)) {
    return "X OAuth1 medya yükleme izni reddedildi. X_API_KEY/X_API_SECRET ile OAuth1 Access Token/Secret aynı X uygulamasına ait olmalı; Access Token kullanıcı bağlamında Read and write iznine sahip olmalı.";
  }

  return xErrorMessage(json, "X OAuth1 medya yuklemesi basarisiz");
}

function xErrorMessage(json: unknown, fallback: string): string {
  const body = json as {
    detail?: string;
    title?: string;
    errors?: Array<{ detail?: string; message?: string; title?: string }>;
  };

  return (
    body?.detail ??
    body?.errors?.[0]?.message ??
    body?.errors?.[0]?.detail ??
    body?.errors?.[0]?.title ??
    body?.title ??
    fallback
  );
}

function isXPermissionFailure(status: number, json: unknown): boolean {
  const body = json as {
    detail?: string;
    status?: number;
    title?: string;
    type?: string;
    errors?: Array<{ detail?: string; message?: string; title?: string }>;
  };

  const parts = [
    body?.type,
    body?.title,
    body?.detail,
    ...(body?.errors ?? []).flatMap((error) => [
      error.title,
      error.detail,
      error.message
    ])
  ];
  const message = parts.filter(Boolean).join(" ").toLowerCase();

  return (
    status === 403 ||
    message.includes("client-forbidden") ||
    message.includes("lacks required access") ||
    message.includes("permission") ||
    message.includes("scope") ||
    (body?.status === 403 && body?.detail?.toLowerCase() === "forbidden")
  );
}

function mediaCategoryForMimeType(mimeType: string): "tweet_image" | null {
  if (
    mimeType === "image/jpeg" ||
    mimeType === "image/png" ||
    mimeType === "image/webp"
  ) {
    return "tweet_image";
  }

  return null;
}

function buildMediaForm(
  media: PublishMedia,
  mediaCategory: "tweet_image"
): FormData {
  const form = new FormData();
  form.append(
    "media",
    new Blob([new Uint8Array(media.buffer)], { type: media.mimeType }),
    media.fileName
  );
  form.append("media_category", mediaCategory);
  form.append("media_type", media.mimeType);

  return form;
}
