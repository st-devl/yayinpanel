import "server-only";

import { ConnectionStatus, Platform, PublishLogStatus } from "@prisma/client";
import { parsePlatformData } from "@/lib/domain/platform-data-store";
import { PublishError } from "@/lib/publishers/errors";
import { runPublish } from "@/lib/publishers";
import type { PublishContext, PublishOutcome } from "@/lib/publishers/types";
import { refreshInstagramToken } from "@/lib/integrations/instagram-token";
import { refreshXAccessToken } from "@/lib/integrations/x-oauth";
import {
  getCustomSiteCredentials,
  getInstagramAccessToken,
  getWordPressCredentials,
  getXTokens,
  setXConnectionStatus,
  updateInstagramAccessToken,
  updateXTokens
} from "@/lib/server/account-credentials";
import { getEnv } from "@/lib/server/env";
import { createSignedMediaFileUrl } from "@/lib/server/media-access";
import { readMediaBinary } from "@/lib/server/media-storage";
import { prisma } from "@/lib/server/prisma";
import { safeJsonStringify } from "@/lib/security/mask";

type CardForPublish = {
  id: string;
  platform: Platform;
  accountId: string;
  text: string | null;
  mediaFileId: string | null;
  platformData: string;
};

/** Bir kart icin PublishContext olusturur (krediler decrypt edilir). */
async function buildPublishContext(card: CardForPublish): Promise<{
  accountId: string;
  context: PublishContext;
  refreshCredentials: () => Promise<PublishContext["credentials"] | null>;
} | null> {
  const platformData = parsePlatformData(card.platform, card.platformData);

  const loadMedia = card.mediaFileId
    ? async () => {
        const media = await readMediaBinary(card.mediaFileId as string);
        return media
          ? {
              buffer: media.buffer,
              mimeType: media.mimeType,
              fileName: media.fileName,
              fileSize: media.fileSize
            }
          : null;
      }
    : undefined;

  const buildSignedMediaUrl = card.mediaFileId
    ? async () => createSignedMediaFileUrl(card.mediaFileId as string).url
    : undefined;

  if (card.platform === Platform.INSTAGRAM) {
    const account = await prisma.instagramAccount.findUnique({
      where: { id: card.accountId },
      select: { instagramBusinessAccountId: true }
    });
    const accessToken = await getInstagramAccessToken(card.accountId);

    if (!account || !accessToken) {
      return null;
    }

    const context: PublishContext = {
      card: { ...card, platformData },
      credentials: {
        accessToken,
        instagramBusinessAccountId: account.instagramBusinessAccountId
      },
      loadMedia,
      buildSignedMediaUrl
    };

    return {
      accountId: card.accountId,
      context,
      refreshCredentials: async () => {
        const env = getEnv();
        if (!env.META_APP_ID || !env.META_APP_SECRET) {
          return null;
        }
        const refreshed = await refreshInstagramToken(
          accessToken,
          env.META_APP_ID,
          env.META_APP_SECRET
        );
        await updateInstagramAccessToken(
          card.accountId,
          refreshed.accessToken,
          refreshed.expiresAt
        );
        return {
          accessToken: refreshed.accessToken,
          instagramBusinessAccountId: account.instagramBusinessAccountId
        };
      }
    };
  }

  if (card.platform === Platform.X) {
    const tokens = await getXTokens(card.accountId, {
      allowSingleAccountFallback: true
    });

    if (!tokens) {
      return null;
    }

    if (tokens.xUserId !== card.accountId) {
      await prisma.contentCard.update({
        where: { id: card.id },
        data: {
          accountId: tokens.xUserId,
          errorCode: null,
          errorMessage: null
        }
      });
    }

    const context: PublishContext = {
      card: { ...card, accountId: tokens.xUserId, platformData },
      credentials: { accessToken: tokens.accessToken, xOAuth1: tokens.oauth1 },
      loadMedia
    };

    return {
      accountId: tokens.xUserId,
      context,
      refreshCredentials: async () => {
        if (!tokens.refreshToken) {
          return null;
        }
        const refreshed = await refreshXAccessToken(tokens.refreshToken);
        await updateXTokens(tokens.xUserId, {
          accessToken: refreshed.accessToken,
          refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
          tokenExpiresAt: refreshed.expiresAt
        });
        return { accessToken: refreshed.accessToken, xOAuth1: tokens.oauth1 };
      }
    };
  }

  if (card.platform === Platform.WORDPRESS) {
    const wordpress = await getWordPressCredentials(card.accountId);

    if (!wordpress) {
      return null;
    }

    const context: PublishContext = {
      card: { ...card, platformData },
      credentials: { accessToken: "", wordpress },
      loadMedia
    };

    return {
      accountId: card.accountId,
      context,
      refreshCredentials: async () => null
    };
  }

  const customSite = await getCustomSiteCredentials(card.accountId);

  if (!customSite) {
    return null;
  }

  const context: PublishContext = {
    card: { ...card, platformData },
    credentials: { accessToken: "", customSite },
    loadMedia,
    buildSignedMediaUrl
  };

  return {
    accountId: card.accountId,
    context,
    refreshCredentials: async () => null
  };
}

/**
 * Bir karti yayinlar ve PublishLog kaydi yazar.
 * Sonuc PublishOutcome olarak doner; scheduler retry/backoff'u yonetir.
 */
export async function publishCard(
  card: CardForPublish
): Promise<PublishOutcome> {
  let built: Awaited<ReturnType<typeof buildPublishContext>>;

  try {
    built = await buildPublishContext(card);
  } catch (rawError) {
    // Kimlik bilgisi cozme/okuma hatasi (or. yanlis ENCRYPTION_KEY).
    // Tick'in cokmemesi icin kalici hata olarak isaretlenir.
    const error =
      rawError instanceof PublishError
        ? rawError
        : new PublishError(
            "PERMANENT",
            "CREDENTIALS_DECRYPT_FAILED",
            "Hesap kimlik bilgileri cozulemedi"
          );
    await writeLog(card, PublishLogStatus.ERROR, "publish", null, error);
    return { ok: false, error };
  }

  if (!built) {
    const error = missingCredentialsError(card);
    await writeLog(card, PublishLogStatus.ERROR, "publish", null, error);
    return { ok: false, error };
  }

  const logCard = { ...card, accountId: built.accountId };
  const outcome = await runPublish(built.context, {
    refreshCredentials: built.refreshCredentials
  });

  if (outcome.ok) {
    await writeLog(
      logCard,
      PublishLogStatus.OK,
      "publish",
      outcome.result.apiResponse,
      null
    );
  } else {
    await writeLog(
      logCard,
      PublishLogStatus.ERROR,
      "publish",
      outcome.error.apiResponse,
      outcome.error
    );
    await updateConnectionStatusFromPublishError(logCard, outcome.error);
  }

  return outcome;
}

async function updateConnectionStatusFromPublishError(
  card: CardForPublish,
  error: PublishError
) {
  if (card.platform !== Platform.X || !error.isAuth) {
    return;
  }

  const connectionStatus = xConnectionStatusFromPublishError(error);

  if (!connectionStatus) {
    return;
  }

  try {
    await setXConnectionStatus(card.accountId, connectionStatus, error.message);
  } catch (statusError) {
    console.error(
      "Failed to update X account connection status after publish error",
      statusError
    );
  }
}

function xConnectionStatusFromPublishError(error: PublishError) {
  if (error.httpStatus === 401) {
    return ConnectionStatus.TOKEN_EXPIRED;
  }

  if (error.httpStatus === 403) {
    return ConnectionStatus.PERMISSION_MISSING;
  }

  return null;
}

function missingCredentialsError(card: CardForPublish) {
  const platformMessage: Record<Platform, string> = {
    [Platform.INSTAGRAM]:
      "Instagram hesabı bulunamadı veya access token kaydı yok. Kart eski/silinmiş bir hesaba bağlı olabilir.",
    [Platform.X]:
      "Bu kartın bağlı olduğu X kullanıcı kimliği için aktif hesap/token bulunamadı. Aynı X hesabını yeniden bağlayın; token yenilense bile kartlar bu kullanıcı kimliğiyle çalışmaya devam eder.",
    [Platform.WORDPRESS]:
      "WordPress sitesi bulunamadı veya credential kaydı yok. Kart eski/silinmiş bir siteye bağlı olabilir.",
    [Platform.CUSTOM_SITE]:
      "Özel site bulunamadı veya API anahtarı kaydı yok. Kart eski/silinmiş bir siteye bağlı olabilir."
  };

  return new PublishError(
    "PERMANENT",
    "CREDENTIALS_NOT_FOUND",
    platformMessage[card.platform]
  );
}

async function writeLog(
  card: CardForPublish,
  status: PublishLogStatus,
  action: string,
  apiResponse: unknown,
  error: PublishError | null
) {
  await prisma.publishLog.create({
    data: {
      platform: card.platform,
      accountId: card.accountId,
      contentCardId: card.id,
      action,
      status,
      apiResponse: apiResponse ? safeJsonStringify(apiResponse) : null,
      errorCode: error?.code ?? null,
      errorMessage: error?.message ?? null
    }
  });
}
