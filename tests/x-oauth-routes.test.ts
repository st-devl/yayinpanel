import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as callbackGET } from "@/app/api/accounts/x/oauth/callback/route";
import { GET as startGET } from "@/app/api/accounts/x/oauth/start/route";
import { exchangeXAuthCode, verifyXToken } from "@/lib/integrations/x-oauth";
import { getCurrentUser } from "@/lib/server/session";
import { getXOAuthCredentials } from "@/lib/server/x-credentials";
import { buildXAuthorizeUrl } from "@/lib/integrations/x-oauth";

vi.mock("@/lib/server/env", () => ({
  getAppBaseUrl: () => "https://yayinpanel.cloud",
  getEnv: () => ({
    APP_BASE_URL: "https://yayinpanel.cloud",
    ENCRYPTION_KEY:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  })
}));

vi.mock("@/lib/server/session", () => ({
  getCurrentUser: vi.fn()
}));

vi.mock("@/lib/server/x-credentials", () => ({
  getXOAuthCredentials: vi.fn()
}));

vi.mock("@/lib/integrations/x-oauth", () => ({
  buildXAuthorizeUrl: vi.fn(),
  exchangeXAuthCode: vi.fn(),
  verifyXToken: vi.fn()
}));

vi.mock("@/lib/server/account-credentials", () => ({
  upsertXAccountFromOAuth: vi.fn()
}));

describe("X OAuth start route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("moves non-canonical hosts to APP_BASE_URL before creating OAuth cookies", async () => {
    const response = await startGET(
      new NextRequest("https://www.yayinpanel.cloud/api/accounts/x/oauth/start")
    );

    expect(response.headers.get("location")).toBe(
      "https://yayinpanel.cloud/api/accounts/x/oauth/start"
    );
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it("creates the PKCE cookies on the canonical host and redirects to X", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "admin@example.com"
    });
    vi.mocked(getXOAuthCredentials).mockResolvedValue({
      clientId: "client-id",
      clientSecret: "client-secret"
    });
    vi.mocked(buildXAuthorizeUrl).mockResolvedValue(
      "https://x.com/i/oauth2/authorize?state=abc"
    );

    const response = await startGET(
      new NextRequest("https://yayinpanel.cloud/api/accounts/x/oauth/start")
    );

    expect(response.headers.get("location")).toBe(
      "https://x.com/i/oauth2/authorize?state=abc"
    );
    expect(response.headers.get("set-cookie")).toContain("x_oauth_state=");
    expect(response.headers.get("set-cookie")).toContain("x_oauth_verifier=");
  });
});

describe("X OAuth callback route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: "user-1",
      email: "admin@example.com"
    });
  });

  it("reports missing callback query parameters separately", async () => {
    const response = await callbackGET(
      new NextRequest("https://yayinpanel.cloud/api/accounts/x/oauth/callback")
    );

    expect(response.headers.get("location")).toBe(
      "https://yayinpanel.cloud/accounts?xoauth=missing_params"
    );
  });

  it("reports a missing OAuth cookie session separately", async () => {
    const response = await callbackGET(
      new NextRequest(
        "https://yayinpanel.cloud/api/accounts/x/oauth/callback?code=code-1&state=state-1"
      )
    );

    expect(response.headers.get("location")).toBe(
      "https://yayinpanel.cloud/accounts?xoauth=session_missing"
    );
  });

  it("keeps rejecting mismatched state values", async () => {
    const response = await callbackGET(
      new NextRequest(
        "https://yayinpanel.cloud/api/accounts/x/oauth/callback?code=code-1&state=state-1",
        {
          headers: {
            Cookie: "x_oauth_state=other-state; x_oauth_verifier=verifier-1"
          }
        }
      )
    );

    expect(response.headers.get("location")).toBe(
      "https://yayinpanel.cloud/accounts?xoauth=state_mismatch"
    );
    expect(exchangeXAuthCode).not.toHaveBeenCalled();
    expect(verifyXToken).not.toHaveBeenCalled();
  });
});
