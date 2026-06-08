import "server-only";

import { ConnectionStatus } from "@prisma/client";
import { refreshXAccessToken } from "@/lib/integrations/x-oauth";
import { PublishError } from "@/lib/publishers/errors";
import {
  getXTokens,
  setXConnectionStatus,
  updateXTokens
} from "@/lib/server/account-credentials";
import { prisma } from "@/lib/server/prisma";

/** Access token bitmeden once yenilemek icin guvenlik tamponu. */
const EXPIRY_SKEW_MS = 5 * 60 * 1000;

type StoredXTokens = NonNullable<Awaited<ReturnType<typeof getXTokens>>>;

export type FreshXToken = {
  accountId: string;
  xUserId: string;
  accessToken: string;
  refreshToken: string | null;
  oauth1: StoredXTokens["oauth1"];
  tokenExpiresAt: Date | null;
  /** Bu cagride token yenilendiyse true. */
  refreshed: boolean;
};

/**
 * Hesap basina es zamanli refresh'leri serilestirir. X refresh token'lari
 * rotasyonludur (her yenilemede eski token gecersiz olur); ayni anda iki
 * yenileme yapilirsa biri digerinin token'ini gecersiz kilar ve zincirleme
 * invalid_grant hatalari olusur. Bu in-process single-flight, tek surec
 * icindeki es zamanli istekleri tek bir refresh'e indirir.
 */
const inflight = new Map<string, Promise<FreshXToken>>();

function needsRefresh(expiresAt: Date | null, now: Date, force: boolean) {
  if (force) return true;
  // Sure bilinmiyorsa proaktif yenileme yapma; mevcut token kullanilir.
  if (!expiresAt) return false;
  return expiresAt.getTime() - now.getTime() <= EXPIRY_SKEW_MS;
}

function toFresh(tokens: StoredXTokens, refreshed: boolean): FreshXToken {
  return {
    accountId: tokens.accountId,
    accessToken: tokens.accessToken,
    oauth1: tokens.oauth1,
    refreshToken: tokens.refreshToken,
    refreshed,
    tokenExpiresAt: tokens.tokenExpiresAt,
    xUserId: tokens.xUserId
  };
}

async function refreshOnce(tokens: StoredXTokens): Promise<FreshXToken> {
  const key = tokens.xUserId;
  const existing = inflight.get(key);
  if (existing) return existing;

  const promise = (async (): Promise<FreshXToken> => {
    if (!tokens.refreshToken) {
      await setXConnectionStatus(
        tokens.xUserId,
        ConnectionStatus.NEEDS_RECONNECT,
        "X refresh token bulunamadi; hesabi yeniden baglayin."
      ).catch(() => undefined);
      throw new PublishError(
        "PERMANENT",
        "X_REFRESH_TOKEN_MISSING",
        "X refresh token bulunamadi; hesabi yeniden baglayin."
      );
    }

    try {
      const refreshed = await refreshXAccessToken(tokens.refreshToken);
      await updateXTokens(tokens.xUserId, {
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
        tokenExpiresAt: refreshed.expiresAt
      });

      return {
        accountId: tokens.accountId,
        accessToken: refreshed.accessToken,
        oauth1: tokens.oauth1,
        refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
        refreshed: true,
        tokenExpiresAt: refreshed.expiresAt,
        xUserId: tokens.xUserId
      };
    } catch (error) {
      const httpStatus =
        error instanceof PublishError ? error.httpStatus : undefined;
      // 4xx (or. invalid_grant) -> refresh token kalici gecersiz, yeniden
      // baglanti sart. Diger hatalar (5xx/ag) gecici sayilip TOKEN_EXPIRED.
      const status =
        httpStatus && httpStatus >= 400 && httpStatus < 500
          ? ConnectionStatus.NEEDS_RECONNECT
          : ConnectionStatus.TOKEN_EXPIRED;
      const message =
        error instanceof PublishError
          ? error.message
          : "X token yenileme basarisiz";
      await setXConnectionStatus(tokens.xUserId, status, message).catch(
        () => undefined
      );
      throw error instanceof PublishError
        ? error
        : new PublishError("TRANSIENT", "X_REFRESH_FAILED", message);
    }
  })();

  inflight.set(key, promise);
  try {
    return await promise;
  } finally {
    inflight.delete(key);
  }
}

/**
 * X token yasam dongusunun tek otoritesi. Gerekiyorsa access token'i proaktif
 * yeniler ve gecerli token'i dondurur. Tum X tuketicileri (publish, verify,
 * scheduler) bu fonksiyon uzerinden gecmeli; ham/stale token kullanilmamali.
 *
 * - Hesap yoksa null doner.
 * - Token bitmek uzereyse (veya force) refresh token ile yeniler ve persist eder.
 * - Refresh gerektigi halde basarisizsa PublishError firlatir ve baglanti
 *   durumunu NEEDS_RECONNECT/TOKEN_EXPIRED olarak isaretler.
 */
export async function ensureFreshXToken(
  accountReference: string,
  options: {
    allowSingleAccountFallback?: boolean;
    now?: Date;
    force?: boolean;
  } = {}
): Promise<FreshXToken | null> {
  const tokens = await getXTokens(accountReference, {
    allowSingleAccountFallback: options.allowSingleAccountFallback
  });
  if (!tokens) return null;

  const now = options.now ?? new Date();
  if (!needsRefresh(tokens.tokenExpiresAt, now, options.force ?? false)) {
    return toFresh(tokens, false);
  }

  return refreshOnce(tokens);
}

/**
 * Suresi yaklasan tum bagli X hesaplarinin token'larini proaktif yeniler.
 * Scheduler tick'inden cagrilir; boylece token'lar yayin anini beklemeden taze
 * tutulur ve panelde "access token suresi dolmus" uyarisi hic olusmaz.
 * Bir hesabin yenilemesi basarisiz olsa bile digerleri etkilenmez.
 */
export async function refreshDueXTokens(
  now: Date = new Date()
): Promise<number> {
  const threshold = new Date(now.getTime() + EXPIRY_SKEW_MS);
  const due = await prisma.xAccount.findMany({
    where: {
      connectionStatus: {
        in: [ConnectionStatus.CONNECTED, ConnectionStatus.TOKEN_EXPIRED]
      },
      tokenExpiresAt: { not: null, lte: threshold }
    },
    select: { xUserId: true }
  });

  let refreshed = 0;
  for (const account of due) {
    try {
      const result = await ensureFreshXToken(account.xUserId, {
        force: true,
        now
      });
      if (result?.refreshed) refreshed += 1;
    } catch (error) {
      console.warn(
        `[x-token] proactive refresh failed for ${account.xUserId}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return refreshed;
}
