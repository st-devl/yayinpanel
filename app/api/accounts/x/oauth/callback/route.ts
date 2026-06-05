import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/session";
import { getEnv } from "@/lib/server/env";
import { exchangeXAuthCode, verifyXToken } from "@/lib/integrations/x-oauth";
import { upsertXAccountFromOAuth } from "@/lib/server/account-credentials";

const STATE_COOKIE = "x_oauth_state";
const VERIFIER_COOKIE = "x_oauth_verifier";

function redirectWith(appUrl: string, params: Record<string, string>) {
  const url = new URL("/accounts", appUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const response = NextResponse.redirect(url);
  // Tek kullanimlik OAuth cookie'lerini temizle.
  response.cookies.delete(STATE_COOKIE);
  response.cookies.delete(VERIFIER_COOKIE);
  return response;
}

/** X OAuth2 (PKCE) callback: code'u user token'a cevirip hesabi kaydeder. */
export async function GET(request: NextRequest) {
  const appUrl = getEnv().APP_BASE_URL;

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", appUrl));
  }

  const { searchParams } = request.nextUrl;
  const error = searchParams.get("error");
  if (error) {
    return redirectWith(appUrl, { xoauth: "denied" });
  }

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const savedState = request.cookies.get(STATE_COOKIE)?.value;
  const codeVerifier = request.cookies.get(VERIFIER_COOKIE)?.value;

  if (!code || !state || !savedState || !codeVerifier) {
    return redirectWith(appUrl, { xoauth: "invalid" });
  }

  if (state !== savedState) {
    return redirectWith(appUrl, { xoauth: "state_mismatch" });
  }

  try {
    const tokens = await exchangeXAuthCode({ code, codeVerifier });

    const me = await verifyXToken(tokens.accessToken);
    if (!me.ok || !me.userId) {
      return redirectWith(appUrl, { xoauth: "verify_failed" });
    }

    await upsertXAccountFromOAuth({
      xUserId: me.userId,
      username: me.username ?? me.userId,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresAt
    });

    return redirectWith(appUrl, {
      xoauth: "success",
      account: me.username ?? me.userId
    });
  } catch {
    return redirectWith(appUrl, { xoauth: "exchange_failed" });
  }
}
