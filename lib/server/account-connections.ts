import "server-only";

import { ConnectionStatus } from "@prisma/client";
import { verifyCustomSiteConnection } from "@/lib/integrations/custom-site";
import { verifyInstagramToken } from "@/lib/integrations/instagram-token";
import { refreshXAccessToken, verifyXToken } from "@/lib/integrations/x-oauth";
import { verifyWordPressConnection } from "@/lib/integrations/wordpress";
import { PublishError } from "@/lib/publishers/errors";
import {
  getCustomSiteCredentials,
  getInstagramAccessToken,
  getWordPressCredentials,
  getXTokens,
  setCustomSiteConnectionStatus,
  setInstagramConnectionStatus,
  setWordPressConnectionStatus,
  setXConnectionStatus,
  updateXTokens
} from "@/lib/server/account-credentials";
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
  const tokens = await getXTokens(accountId);

  if (!tokens) {
    return { ok: false, connectionStatus: ConnectionStatus.DISCONNECTED };
  }

  const result = await verifyXToken(tokens.accessToken);

  if (result.ok) {
    await setXConnectionStatus(accountId, ConnectionStatus.CONNECTED);
    return { ok: true, connectionStatus: ConnectionStatus.CONNECTED };
  }

  const connectionStatus = statusFromHttp(result.status);
  await setXConnectionStatus(accountId, connectionStatus, result.message);

  return { ok: false, connectionStatus, message: result.message };
}

/** X hesabini saklanan refresh token ile yeniden baglar. */
export async function reconnectXAccount(
  accountId: string
): Promise<ConnectionTestResult> {
  const tokens = await getXTokens(accountId);

  if (!tokens?.refreshToken) {
    await setXConnectionStatus(
      accountId,
      ConnectionStatus.NEEDS_RECONNECT,
      "Refresh token bulunamadi"
    );
    return {
      ok: false,
      connectionStatus: ConnectionStatus.NEEDS_RECONNECT,
      message: "Refresh token bulunamadi"
    };
  }

  try {
    const refreshed = await refreshXAccessToken(tokens.refreshToken);
    await updateXTokens(accountId, {
      accessToken: refreshed.accessToken,
      refreshToken: refreshed.refreshToken ?? tokens.refreshToken,
      tokenExpiresAt: refreshed.expiresAt
    });

    return { ok: true, connectionStatus: ConnectionStatus.CONNECTED };
  } catch (error) {
    const message =
      error instanceof PublishError
        ? error.message
        : "X yeniden baglanti basarisiz";
    const connectionStatus =
      error instanceof PublishError && error.httpStatus
        ? statusFromHttp(error.httpStatus)
        : ConnectionStatus.NEEDS_RECONNECT;

    await setXConnectionStatus(accountId, connectionStatus, message);
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
