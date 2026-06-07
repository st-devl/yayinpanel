import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyXToken, X_OAUTH_SCOPES } from "@/lib/integrations/x-oauth";

describe("X OAuth token verification", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the X user identity for a valid OAuth2 token", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toEqual({
        Authorization: "Bearer valid-token"
      });

      return jsonResponse(200, {
        data: { id: "12345", username: "patlat" }
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(verifyXToken("valid-token")).resolves.toEqual({
      ok: true,
      status: 200,
      userId: "12345",
      username: "patlat"
    });
  });

  it("explains expired or invalid tokens", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(401, {})));

    await expect(verifyXToken("expired-token")).resolves.toMatchObject({
      ok: false,
      status: 401,
      message:
        "X access token gecersiz veya suresi dolmus. OAuth2 user access token ile yeniden baglayin."
    });
  });

  it("explains missing OAuth2 scopes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(403, {})));

    await expect(verifyXToken("limited-token")).resolves.toMatchObject({
      ok: false,
      status: 403,
      message:
        "X access token gerekli izinlere sahip degil. users.read izniyle OAuth2 token olusturun."
    });
  });

  it("explains X API rate limiting", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(429, {})));

    await expect(verifyXToken("rate-limited-token")).resolves.toMatchObject({
      ok: false,
      status: 429,
      message: "X API rate limit asildi. Bir sure sonra tekrar deneyin."
    });
  });
});

describe("X OAuth scopes", () => {
  it("requests every scope needed for posting, media upload and refresh", () => {
    expect(X_OAUTH_SCOPES).toBe(
      "tweet.read tweet.write users.read offline.access media.write"
    );

    const scopes = new Set(X_OAUTH_SCOPES.split(" "));

    expect(scopes).toEqual(
      new Set([
        "tweet.read",
        "tweet.write",
        "users.read",
        "media.write",
        "offline.access"
      ])
    );
  });
});

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}
