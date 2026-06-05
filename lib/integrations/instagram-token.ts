import "server-only";

import { classifyHttpStatus } from "@/lib/publishers/errors";
import { fetchWithTimeout, readJsonResponse } from "@/lib/publishers/http";

const GRAPH_BASE = "https://graph.facebook.com/v21.0";

export type InstagramTokenRefresh = {
  accessToken: string;
  expiresAt: Date | null;
};

/**
 * Uzun omurlu Instagram/Facebook tokenini yeniler.
 * fb_exchange_token akisi yerine long-lived refresh kullanir.
 */
export async function refreshInstagramToken(
  accessToken: string,
  appId: string,
  appSecret: string
): Promise<InstagramTokenRefresh> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: accessToken
  });

  const response = await fetchWithTimeout(
    `${GRAPH_BASE}/oauth/access_token?${params.toString()}`
  );
  const result = await readJsonResponse(response);

  if (!result.ok) {
    throw classifyHttpStatus(
      result.status,
      "IG_REFRESH_FAILED",
      "Instagram token yenileme basarisiz",
      result.json
    );
  }

  const body = result.json as { access_token?: string; expires_in?: number };

  return {
    accessToken: body.access_token ?? accessToken,
    expiresAt: body.expires_in
      ? new Date(Date.now() + body.expires_in * 1000)
      : null
  };
}

/** IG business account kimligini sorgulayarak tokeni dogrular. */
export async function verifyInstagramToken(
  accessToken: string,
  instagramBusinessAccountId: string
): Promise<{
  ok: boolean;
  status: number;
  username?: string;
  message?: string;
}> {
  const params = new URLSearchParams({
    fields: "username,name",
    access_token: accessToken
  });
  const response = await fetchWithTimeout(
    `${GRAPH_BASE}/${instagramBusinessAccountId}?${params.toString()}`
  );
  const result = await readJsonResponse(response);

  if (!result.ok) {
    const body = result.json as { error?: { message?: string } };
    return {
      ok: false,
      status: result.status,
      message: body?.error?.message ?? "Instagram token dogrulama basarisiz"
    };
  }

  return {
    ok: true,
    status: result.status,
    username: (result.json as { username?: string })?.username
  };
}
