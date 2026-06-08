import { ConnectionStatus } from "@prisma/client";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/accounts/x/route";
import {
  upsertXAccountFromOAuth,
  xAccountSafeSelect
} from "@/lib/server/account-credentials";
import { requireApiUser } from "@/lib/server/api-auth";
import { prisma } from "@/lib/server/prisma";

vi.mock("@/lib/server/api-auth", () => ({
  requireApiUser: vi.fn()
}));

vi.mock("@/lib/server/account-credentials", () => ({
  upsertXAccountFromOAuth: vi.fn(),
  xAccountSafeSelect: {
    accountName: true,
    connectionStatus: true,
    createdAt: true,
    id: true,
    lastError: true,
    profileImageUrl: true,
    tokenExpiresAt: true,
    updatedAt: true,
    username: true,
    xUserId: true
  }
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    xAccount: {
      findMany: vi.fn()
    }
  }
}));

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  process.env.ADMIN_PASSWORD = "short";
  process.env.X_API_KEY = "consumer-key";
  process.env.X_API_SECRET = "consumer-secret";
  vi.mocked(requireApiUser).mockResolvedValue({
    response: null,
    user: { email: "admin@example.com", id: "user-1" }
  });
});

describe("X accounts API route", () => {
  it("lists X accounts without validating unrelated bootstrap env", async () => {
    vi.mocked(prisma.xAccount.findMany).mockResolvedValue([
      {
        accountName: "Hekim Efendi",
        connectionStatus: ConnectionStatus.CONNECTED,
        createdAt: new Date("2026-06-08T10:00:00.000Z"),
        id: "x-account-1",
        lastError: null,
        oauth1AccessTokenEncrypted: "encrypted-token",
        oauth1AccessTokenSecretEncrypted: null,
        profileImageUrl: null,
        tokenExpiresAt: null,
        updatedAt: new Date("2026-06-08T10:00:00.000Z"),
        username: "codemapp",
        xUserId: "1491385237607170058"
      }
    ] as never);

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(prisma.xAccount.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      select: {
        ...xAccountSafeSelect,
        oauth1AccessTokenEncrypted: true,
        oauth1AccessTokenSecretEncrypted: true
      }
    });
    expect(payload.xApiCredentials).toEqual({
      configured: true,
      consumerKeySet: true,
      consumerSecretSet: true
    });
    expect(payload.data[0]).toMatchObject({
      hasOAuth1MediaCredentials: false,
      id: "x-account-1",
      username: "codemapp"
    });
    expect(payload.data[0]).not.toHaveProperty("oauth1AccessTokenEncrypted");
    expect(payload.data[0]).not.toHaveProperty(
      "oauth1AccessTokenSecretEncrypted"
    );
  });

  it("rejects malformed create payloads as JSON", async () => {
    const response = await POST(
      new NextRequest("https://yayinpanel.cloud/api/accounts/x", {
        body: "",
        headers: { "Content-Type": "application/json" },
        method: "POST"
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Gecersiz hesap verisi");
    expect(upsertXAccountFromOAuth).not.toHaveBeenCalled();
  });
});
