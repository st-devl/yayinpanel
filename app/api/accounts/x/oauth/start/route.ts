import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/server/session";
import { getEnv } from "@/lib/server/env";
import { getXOAuthCredentials } from "@/lib/server/x-credentials";
import { buildXAuthorizeUrl } from "@/lib/integrations/x-oauth";

const STATE_COOKIE = "x_oauth_state";
const VERIFIER_COOKIE = "x_oauth_verifier";
const COOKIE_MAX_AGE_SECONDS = 600;

function base64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** "X ile Baglan": PKCE verifier/state uretir, cookie'ye yazar, X'e yonlendirir. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", getEnv().APP_BASE_URL));
  }

  const env = getEnv();
  const appUrl = env.APP_BASE_URL;

  const credentials = await getXOAuthCredentials();
  if (!credentials.clientId || !credentials.clientSecret) {
    return NextResponse.redirect(
      new URL("/accounts?xoauth=config_error", appUrl)
    );
  }

  const state = base64Url(randomBytes(24));
  const codeVerifier = base64Url(randomBytes(48));
  const codeChallenge = base64Url(
    createHash("sha256").update(codeVerifier).digest()
  );

  const authorizeUrl = await buildXAuthorizeUrl({ state, codeChallenge });
  const response = NextResponse.redirect(authorizeUrl);

  const secure = appUrl.startsWith("https://");
  const cookieOptions = {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS
  };

  response.cookies.set(STATE_COOKIE, state, cookieOptions);
  response.cookies.set(VERIFIER_COOKIE, codeVerifier, cookieOptions);

  return response;
}
