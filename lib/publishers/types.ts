import "server-only";

import type { Platform } from "@prisma/client";
import type { PublishError } from "@/lib/publishers/errors";

/**
 * Bir kartin yayinlanmasi icin gereken tum baglam.
 * Scheduler/publisher cagrisi sirasinda olusturulur.
 */
export type PublishContext = {
  card: {
    id: string;
    platform: Platform;
    accountId: string;
    text: string | null;
    mediaFileId: string | null;
    platformData: unknown;
  };
  /** Platforma erisim icin cozulmus (decrypted) kimlik bilgileri. */
  credentials: PublishCredentials;
  /** Medya gerekiyorsa binary erisim saglar. */
  loadMedia?: () => Promise<PublishMedia | null>;
  /** Public erisilebilir signed media URL uretir (Instagram icin). */
  buildSignedMediaUrl?: () => Promise<string | null>;
};

export type PublishCredentials = {
  accessToken: string;
  refreshToken?: string | null;
  /** Instagram icin business account id. */
  instagramBusinessAccountId?: string;
  /** WordPress icin site temel bilgileri. */
  wordpress?: {
    baseUrl: string;
    username: string;
    applicationPassword: string;
  };
  /** Ozel Next.js/Laravel/vs. site icin temel bilgiler. */
  customSite?: {
    baseUrl: string;
    apiKey: string;
  };
};

export type PublishMedia = {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  fileSize: number;
};

export type PublishResult = {
  status: "PUBLISHED";
  externalPostId: string;
  externalPostUrl: string | null;
  apiResponse?: unknown;
};

/**
 * Tum platform publisher'larinin uyguladigi ortak sozlesme.
 */
export interface Publisher {
  readonly platform: Platform;
  publish(context: PublishContext): Promise<PublishResult>;
}

export type PublishOutcome =
  | { ok: true; result: PublishResult }
  | { ok: false; error: PublishError };
