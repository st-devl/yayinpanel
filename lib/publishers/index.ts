import "server-only";

import { Platform } from "@prisma/client";
import { CustomSitePublisher } from "@/lib/publishers/custom-site-publisher";
import { InstagramPublisher } from "@/lib/publishers/instagram-publisher";
import { XPublisher } from "@/lib/publishers/x-publisher";
import { WordPressPublisher } from "@/lib/publishers/wordpress-publisher";
import { normalizeUnknownError, PublishError } from "@/lib/publishers/errors";
import type {
  PublishContext,
  PublishOutcome,
  PublishResult,
  Publisher
} from "@/lib/publishers/types";

const publishers: Record<Platform, Publisher> = {
  [Platform.INSTAGRAM]: new InstagramPublisher(),
  [Platform.X]: new XPublisher(),
  [Platform.WORDPRESS]: new WordPressPublisher(),
  [Platform.CUSTOM_SITE]: new CustomSitePublisher()
};

export function getPublisher(platform: Platform): Publisher {
  return publishers[platform];
}

export type RunPublishOptions = {
  /**
   * AUTH (401/403) hatasinda tek sefer token yenilemeyi dener.
   * Yeni access token donerse publish tekrar denenir.
   */
  refreshCredentials?: () => Promise<PublishContext["credentials"] | null>;
};

/**
 * Publisher'i calistirir; AUTH hatasinda tek sefer refresh + retry uygular.
 * Sonuc her zaman PublishOutcome olarak doner (throw etmez).
 */
export async function runPublish(
  context: PublishContext,
  options: RunPublishOptions = {}
): Promise<PublishOutcome> {
  const publisher = getPublisher(context.card.platform);

  try {
    const result = await publisher.publish(context);
    return { ok: true, result };
  } catch (rawError) {
    const error = toPublishError(rawError);

    if (error.isAuth && options.refreshCredentials) {
      const refreshed = await tryRefreshAndRetry(publisher, context, options);

      if (refreshed) {
        return refreshed;
      }
    }

    return { ok: false, error };
  }
}

async function tryRefreshAndRetry(
  publisher: Publisher,
  context: PublishContext,
  options: RunPublishOptions
): Promise<PublishOutcome | null> {
  let newCredentials: PublishContext["credentials"] | null = null;

  try {
    newCredentials = (await options.refreshCredentials?.()) ?? null;
  } catch {
    return null;
  }

  if (!newCredentials) {
    return null;
  }

  try {
    const result: PublishResult = await publisher.publish({
      ...context,
      credentials: newCredentials
    });
    return { ok: true, result };
  } catch (retryError) {
    return { ok: false, error: toPublishError(retryError) };
  }
}

function toPublishError(error: unknown): PublishError {
  return error instanceof PublishError ? error : normalizeUnknownError(error);
}

export type { PublishContext, PublishOutcome, PublishResult, Publisher };
export { PublishError };
