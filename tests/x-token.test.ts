import { ConnectionStatus } from "@prisma/client";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refreshXAccessToken } from "@/lib/integrations/x-oauth";
import { PublishError } from "@/lib/publishers/errors";
import { createXAccount, getXTokens } from "@/lib/server/account-credentials";
import {
  ensureFreshXToken,
  refreshDueXTokens
} from "@/lib/server/x-token";
import { prisma } from "@/lib/server/prisma";

vi.mock("@/lib/integrations/x-oauth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/integrations/x-oauth")>();
  return { ...actual, refreshXAccessToken: vi.fn() };
});

const refreshMock = vi.mocked(refreshXAccessToken);
const testAccountIds = new Set<string>();

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function createAccount(input: {
  tokenExpiresAt: Date | null;
  refreshToken?: string | null;
  connectionStatus?: ConnectionStatus;
}) {
  const xUserId = uniqueId("x-user");
  const account = await createXAccount({
    accessToken: "old-access-token",
    accountName: "Token Account",
    username: "token_account",
    xUserId,
    refreshToken:
      input.refreshToken === undefined ? "old-refresh-token" : input.refreshToken,
    tokenExpiresAt: input.tokenExpiresAt,
    connectionStatus: input.connectionStatus ?? ConnectionStatus.CONNECTED
  });
  testAccountIds.add(account.id);
  return account;
}

beforeEach(() => {
  refreshMock.mockReset();
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (testAccountIds.size) {
    await prisma.xAccount.deleteMany({
      where: { id: { in: [...testAccountIds] } }
    });
    testAccountIds.clear();
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("ensureFreshXToken", () => {
  it("does not refresh a token that is comfortably valid", async () => {
    const account = await createAccount({
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    const result = await ensureFreshXToken(account.xUserId);

    expect(refreshMock).not.toHaveBeenCalled();
    expect(result?.refreshed).toBe(false);
    expect(result?.accessToken).toBe("old-access-token");
  });

  it("proactively refreshes and persists a token that is near expiry", async () => {
    const account = await createAccount({
      tokenExpiresAt: new Date(Date.now() + 60 * 1000)
    });
    const newExpiry = new Date(Date.now() + 2 * 60 * 60 * 1000);
    refreshMock.mockResolvedValue({
      accessToken: "fresh-access-token",
      refreshToken: "rotated-refresh-token",
      expiresAt: newExpiry
    });

    const result = await ensureFreshXToken(account.xUserId);

    expect(refreshMock).toHaveBeenCalledOnce();
    expect(refreshMock).toHaveBeenCalledWith("old-refresh-token");
    expect(result?.refreshed).toBe(true);
    expect(result?.accessToken).toBe("fresh-access-token");

    // Rotasyona giren yeni token'lar DB'ye yazilmis olmali.
    const stored = await getXTokens(account.xUserId);
    expect(stored?.accessToken).toBe("fresh-access-token");
    expect(stored?.refreshToken).toBe("rotated-refresh-token");
  });

  it("marks the account NEEDS_RECONNECT when an expired token has no refresh token", async () => {
    const account = await createAccount({
      tokenExpiresAt: new Date(Date.now() - 1000),
      refreshToken: null
    });

    await expect(ensureFreshXToken(account.xUserId)).rejects.toMatchObject({
      code: "X_REFRESH_TOKEN_MISSING"
    });
    expect(refreshMock).not.toHaveBeenCalled();

    const stored = await prisma.xAccount.findUniqueOrThrow({
      where: { id: account.id }
    });
    expect(stored.connectionStatus).toBe(ConnectionStatus.NEEDS_RECONNECT);
  });

  it("marks the account NEEDS_RECONNECT when the refresh grant is rejected (4xx)", async () => {
    const account = await createAccount({
      tokenExpiresAt: new Date(Date.now() - 1000)
    });
    refreshMock.mockRejectedValue(
      new PublishError("PERMANENT", "X_REFRESH_FAILED", "invalid_grant", {
        httpStatus: 400
      })
    );

    await expect(ensureFreshXToken(account.xUserId)).rejects.toBeInstanceOf(
      PublishError
    );

    const stored = await prisma.xAccount.findUniqueOrThrow({
      where: { id: account.id }
    });
    expect(stored.connectionStatus).toBe(ConnectionStatus.NEEDS_RECONNECT);
  });

  it("serialises concurrent refreshes into a single token rotation (single-flight)", async () => {
    const account = await createAccount({
      tokenExpiresAt: new Date(Date.now() + 60 * 1000)
    });
    refreshMock.mockImplementation(async () => {
      // Yenileme pending iken ikinci cagrinin yetismesi icin kucuk gecikme.
      await new Promise((resolve) => setTimeout(resolve, 20));
      return {
        accessToken: "fresh-access-token",
        refreshToken: "rotated-refresh-token",
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
      };
    });

    const [a, b] = await Promise.all([
      ensureFreshXToken(account.xUserId, { force: true }),
      ensureFreshXToken(account.xUserId, { force: true })
    ]);

    expect(refreshMock).toHaveBeenCalledOnce();
    expect(a?.accessToken).toBe("fresh-access-token");
    expect(b?.accessToken).toBe("fresh-access-token");
  });
});

describe("refreshDueXTokens", () => {
  it("refreshes accounts whose token is near expiry and leaves valid ones untouched", async () => {
    const dueAccount = await createAccount({
      tokenExpiresAt: new Date(Date.now() + 60 * 1000)
    });
    const freshAccount = await createAccount({
      tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });
    refreshMock.mockResolvedValue({
      accessToken: "fresh-access-token",
      refreshToken: "rotated-refresh-token",
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
    });

    const refreshed = await refreshDueXTokens(new Date());

    expect(refreshed).toBe(1);
    expect(refreshMock).toHaveBeenCalledOnce();

    const due = await getXTokens(dueAccount.xUserId);
    const fresh = await getXTokens(freshAccount.xUserId);
    expect(due?.accessToken).toBe("fresh-access-token");
    expect(fresh?.accessToken).toBe("old-access-token");
  });
});
