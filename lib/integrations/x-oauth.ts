import "server-only";

import { getEnv } from "@/lib/server/env";
import { getXOAuthCredentials } from "@/lib/server/x-credentials";
import { classifyHttpStatus, permanentError } from "@/lib/publishers/errors";
import { fetchWithTimeout, readJsonResponse } from "@/lib/publishers/http";

const X_TOKEN_URL = "https://api.x.com/2/oauth2/token";
const X_ME_URL = "https://api.x.com/2/users/me";
const X_AUTHORIZE_URL = "https://x.com/i/oauth2/authorize";

/**
 * Tweet atmak icin user-context gerekir. offline.access refresh token saglar;
 * boylece access token suresi dolunca otomatik yenilenebilir.
 */
export const X_OAUTH_SCOPES = [
  "tweet.read",
  "tweet.write",
  "users.read",
  "media.write",
  "offline.access"
].join(" ");

export type XTokenResponse = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
};

/** OAuth2 callback URL'i (X Developer Portal'a bu URL eklenmeli). */
export function getXRedirectUri(): string {
  const env = getEnv();
  return `${env.APP_BASE_URL.replace(/\/$/, "")}/api/accounts/x/oauth/callback`;
}

/** Kullanicinin yetki verecegi X OAuth2 (PKCE) authorize URL'ini olusturur. */
export async function buildXAuthorizeUrl(input: {
  state: string;
  codeChallenge: string;
}): Promise<string> {
  const { clientId } = await getXOAuthCredentials();

  if (!clientId) {
    throw permanentError(
      "X_OAUTH_NOT_CONFIGURED",
      "X Client ID tanimli olmali (Ayarlar > X API)"
    );
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: getXRedirectUri(),
    scope: X_OAUTH_SCOPES,
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256"
  });

  return `${X_AUTHORIZE_URL}?${params.toString()}`;
}

/** authorization_code grant: callback'te gelen code'u user token'a cevirir. */
export async function exchangeXAuthCode(input: {
  code: string;
  codeVerifier: string;
}): Promise<XTokenResponse> {
  const credentials = await getXOAuthCredentials();
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: getXRedirectUri(),
    code_verifier: input.codeVerifier,
    client_id: credentials.clientId
  });

  const response = await fetchWithTimeout(X_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicClientAuth(credentials),
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
  const result = await readJsonResponse(response);

  if (!result.ok) {
    throw classifyHttpStatus(
      result.status,
      "X_CODE_EXCHANGE_FAILED",
      "X yetkilendirme kodu degisimi basarisiz",
      result.json
    );
  }

  return parseTokenResponse(result.json);
}

function basicClientAuth(credentials: {
  clientId: string;
  clientSecret: string;
}) {
  if (!credentials.clientId || !credentials.clientSecret) {
    throw permanentError(
      "X_OAUTH_NOT_CONFIGURED",
      "X Client ID ve Client Secret tanimli olmali (Ayarlar > X API)"
    );
  }

  const token = Buffer.from(
    `${credentials.clientId}:${credentials.clientSecret}`
  ).toString("base64");

  return `Basic ${token}`;
}

/** OAuth2 refresh_token grant ile yeni access/refresh token alir. */
export async function refreshXAccessToken(
  refreshToken: string
): Promise<XTokenResponse> {
  const credentials = await getXOAuthCredentials();
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: credentials.clientId
  });

  const response = await fetchWithTimeout(X_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: basicClientAuth(credentials),
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
