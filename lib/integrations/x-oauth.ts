import "server-only";

import { getEnv } from "@/lib/server/env";
import { classifyHttpStatus, permanentError } from "@/lib/publishers/errors";
import { fetchWithTimeout, readJsonResponse } from "@/lib/publishers/http";

const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";
const X_ME_URL = "https://api.twitter.com/2/users/me";

export type XTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
};

function basicClientAuth() {
  const env = getEnv();

  if (!env.X_CLIENT_ID || !env.X_CLIENT_SECRET) {
    throw permanentError(
      "X_OAUTH_NOT_CONFIGURED",
      "X_CLIENT_ID ve X_CLIENT_SECRET tanimli olmali"
    );
  }

  const token = Buffer.from(
    `${env.X_CLIENT_ID}:${env.X_CLIENT_SECRET}`
  ).toString("base64");

  return `Basic ${token}`;
}

/** OAuth2 refresh_token grant ile yeni access/refresh token alir. */
export async function refreshXAccessToken(
  refreshToken: string
): Promise<XTokenResponse> {
  const env = getEnv();
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: env.X_CLIENT_ID
  });

  const response = await fetchWithTimeout(X_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicClientAuth(),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
  const result = await readJsonResponse(response);

  if (!result.ok) {
    throw classifyHttpStatus(
      result.status,
      "X_REFRESH_FAILED",
      "X token yenileme basarisiz",
      result.json
    );
  }

  return parseTokenResponse(result.json);
}

function parseTokenResponse(json: unknown): XTokenResponse {
  const body = json as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
  };

  if (!body.access_token) {
    throw permanentError("X_TOKEN_NO_ACCESS", "X access token alinamadi");
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? null,
    expiresAt: body.expires_in
      ? new Date(Date.now() + body.expires_in * 1000)
      : null
  };
}

/** Erisim tokeninin gecerli olup olmadigini /users/me ile dogrular. */
export async function verifyXToken(accessToken: string): Promise<{
  ok: boolean;
  status: number;
  username?: string;
  userId?: string;
  message?: string;
}> {
  const response = await fetchWithTimeout(`${X_ME_URL}?user.fields=username`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  const result = await readJsonResponse(response);

  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      message: xTokenVerificationMessage(result.status)
    };
  }

  const data = (result.json as { data?: { id?: string; username?: string } })
    ?.data;

  return {
    ok: true,
    status: result.status,
    userId: data?.id,
    username: data?.username
  };
}

function xTokenVerificationMessage(status: number) {
  if (status === 401) {
    return "X access token gecersiz veya suresi dolmus. OAuth2 user access token ile yeniden baglayin.";
  }

  if (status === 403) {
    return "X access token gerekli izinlere sahip degil. users.read izniyle OAuth2 token olusturun.";
  }

  if (status === 429) {
    return "X API rate limit asildi. Bir sure sonra tekrar deneyin.";
  }

  return `X token dogrulama basarisiz (HTTP ${status})`;
}
