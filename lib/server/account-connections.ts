import "server-only";

import { ConnectionStatus } from "@prisma/client";
import { verifyCustomSiteConnection } from "@/lib/integrations/custom-site";
import { verifyInstagramToken } from "@/lib/integrations/instagram-token";
import { verifyXToken } from "@/lib/integrations/x-oauth";
import { verifyWordPressConnection } from "@/lib/integrations/wordpress";
import { PublishError } from "@/lib/publishers/errors";
import {
  getCustomSiteCredentials,
  getInstagramAccessToken,
  getWordPressCredentials,
  setCustomSiteConnectionStatus,
  setInstagramConnectionStatus,
  setWordPressConnectionStatus,
  setXConnectionStatus
} from "@/lib/server/account-credentials";
import { ensureFreshXToken } from "@/lib/server/x-token";
import { prisma } from "@/lib/server/prisma";

export type ConnectionTestResult = {
  ok: boolean;
  connectionStatus: ConnectionStatus;
  message?: string;
};

/** HTTP statu kodunu ConnectionStatus'a esler. */
function statusFromHttp(status: number): ConnectionStatus {
  if (status === 401) {
    return ConnectionStatus.TOKEN_EXPIRED;
  }

  if (status === 403) {
    return ConnectionStatus.PERMISSION_MISSING;
  }

  if (status === 429) {
    return ConnectionStatus.RATE_LIMITED;
  }

  return ConnectionStatus.FAILED;
}

export async function testInstagramConnection(
  accountId: string
): Promise<ConnectionTestResult> {
  const account = await prisma.instagramAccount.findUnique({
    where: { id: accountId },
    select: { instagramBusinessAccountId: true }
  });
  const accessToken = await getInstagramAccessToken(accountId);

  if (!account || !accessToken) {
    return { ok: false, connectionStatus: ConnectionStatus.DISCONNECTED };
  }

  const result = await verifyInstagramToken(
    accessToken,
    account.instagramBusinessAccountId
  );

  if (result.ok) {
    await setInstagramConnectionStatus(accountId, ConnectionStatus.CONNECTED);
    return { ok: true, connectionStatus: ConnectionStatus.CONNECTED };
  }

  const connectionStatus = statusFromHttp(result.status);
  await setInstagramConnectionStatus(
    accountId,
    connectionStatus,
    result.message
  );

  return { ok: false, connectionStatus, message: result.message };
}

export async function testXConnection(
  accountId: string
): Promise<ConnectionTestResult> {
  // Tek otorite: token bitmek uzereyse dogrulamadan once proaktif yenilenir.
  let tokens: Awaited<ReturnType<typeof ensureFreshXToken>>;
  try {
    tokens = await ensureFreshXToken(accountId);
  } catch (error) {
    // Refresh gerekti ama basarisiz oldu -> ensureFreshXToken durumu zaten
    // NEEDS_RECONNECT/TOKEN_EXPIRED olarak isaretledi.
    const message =
      error instanceof PublishError ? error.message : "X token yenilenemedi";
    const connectionStatus =
      error instanceof PublishError && error.httpStatus
        ? statusFromHttp(error.httpStatus)
        : ConnectionStatus.NEEDS_RECONNECT;
    return { ok: false, connectionStatus, message };
  }

  if (!tokens) {
    return { ok: false, connectionStatus: ConnectionStatus.DISCONNECTED };
  }

  let result = await verifyXToken(tokens.accessToken);

  // Proaktif token taze olsa da sunucu tarafinda iptal edilmis olabilir;
  // 401'de refresh token ile bir kez zorla yenileyip tekrar dogrula.
  if (!result.ok && result.status === 401) {
    const refreshed = await ensureFreshXToken(accountId, {
      force: true
    }).catch(() => null);
    if (refreshed) {
      result = await verifyXToken(refreshed.accessToken);
    }
  }

  if (result.ok) {
    await setXConnectionStatus(accountId, ConnectionStatus.CONNECTED);
    return {
      ok: true,
      connectionStatus: ConnectionStatus.CONNECTED,
      message:
        "X kullanıcı tokenı doğrulandı. Gönderim için X uygulaması Read and write izinli olmalı ve hesap tweet.write kapsamıyla yeniden bağlanmış olmalı."
    };
  }

  const connectionStatus = statusFromHttp(result.status);
  await setXConnectionStatus(accountId, connectionStatus, result.message);

  return { ok: false, connectionStatus, message: result.message };
}

/** X hesabini saklanan refresh token ile yeniden baglar. */
export async function reconnectXAccount(
  accountId: string
): Promise<ConnectionTestResult> {
  try {
    // Tek otorite uzerinden zorla yenile; durum/persist orada yonetilir.
    const refreshed = await ensureFreshXToken(accountId, { force: true });

    if (!refreshed) {
      return { ok: false, connectionStatus: ConnectionStatus.DISCONNECTED };
    }

    await setXConnectionStatus(accountId, ConnectionStatus.CONNECTED);
    return { ok: true, connectionStatus: ConnectionStatus.CONNECTED };
  } catch (error) {
    // ensureFreshXToken baglanti durumunu zaten isaretledi; mesaji yuzeye cikar.
    const message =
      error instanceof PublishError
        ? error.message
        : "X yeniden baglanti basarisiz";
    const connectionStatus =
      error instanceof PublishError && error.httpStatus
        ? statusFromHttp(error.httpStatus)
        : ConnectionStatus.NEEDS_RECONNECT;

    return { ok: false, connectionStatus, message };
  }
}

export async function testCustomSiteConnection(
  siteId: string
): Promise<ConnectionTestResult> {
  const credentials = await getCustomSiteCredentials(siteId);

  if (!credentials) {
    return { ok: false, connectionStatus: ConnectionStatus.DISCONNECTED };
  }

  const result = await verifyCustomSiteConnection(credentials);

  if (result.ok) {
    await setCustomSiteConnectionStatus(siteId, ConnectionStatus.CONNECTED);
    return { ok: true, connectionStatus: ConnectionStatus.CONNECTED };
  }

  const connectionStatus = statusFromHttp(result.status);
  await setCustomSiteConnectionStatus(siteId, connectionStatus, result.message);

  return { ok: false, connectionStatus, message: result.message };
}

export async function testWordPressConnection(
  siteId: string
): Promise<ConnectionTestResult> {
  const credentials = await getWordPressCredentials(siteId);

  if (!credentials) {
    return { ok: false, connectionStatus: ConnectionStatus.DISCONNECTED };
  }

  const result = await verifyWordPressConnection(credentials);

  if (result.ok) {
    await setWordPressConnectionStatus(siteId, ConnectionStatus.CONNECTED);
    return { ok: true, connectionStatus: ConnectionStatus.CONNECTED };
  }

  const connectionStatus = statusFromHttp(result.status);
  await setWordPressConnectionStatus(siteId, connectionStatus, result.message);

  return { ok: false, connectionStatus, message: result.message };
}
