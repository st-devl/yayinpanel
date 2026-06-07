import { Platform } from "@prisma/client";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  createXAccount,
  getXTokens,
  updateXTokens
} from "@/lib/server/account-credentials";
import { publishCard } from "@/lib/server/publish-runner";
import { prisma } from "@/lib/server/prisma";

const testAccountIds = new Set<string>();
const testAccountRefs = new Set<string>();
const testCardIds = new Set<string>();

function uniqueId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status
  });
}

afterEach(async () => {
  vi.restoreAllMocks();

  const cardIds = [...testCardIds];
  const accountIds = [...testAccountIds];
  const accountRefs = [...testAccountRefs];

  if (cardIds.length || accountRefs.length) {
    await prisma.publishLog.deleteMany({
      where: {
        OR: [
          ...(cardIds.length ? [{ contentCardId: { in: cardIds } }] : []),
          ...(accountRefs.length ? [{ accountId: { in: accountRefs } }] : [])
        ]
      }
    });
  }

  if (cardIds.length) {
    await prisma.contentCard.deleteMany({ where: { id: { in: cardIds } } });
  }

  if (accountIds.length) {
    await prisma.xAccount.deleteMany({ where: { id: { in: accountIds } } });
  }

  testAccountIds.clear();
  testAccountRefs.clear();
  testCardIds.clear();
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function createConnectedXAccount() {
  const xUserId = uniqueId("stable-x-user");
  const account = await createXAccount({
    accessToken: "access-token",
    accountName: "Stable X Account",
    username: "stable_account",
    xUserId
  });

  testAccountIds.add(account.id);
  testAccountRefs.add(account.id);
  testAccountRefs.add(account.xUserId);

  return account;
}

async function createXCard(accountId: string) {
  const card = await prisma.contentCard.create({
    data: {
      accountId,
      accountType: "X",
      platform: Platform.X,
      platformData: JSON.stringify({ hasMedia: false }),
      text: "Stable account reference test"
    }
  });
  testCardIds.add(card.id);
  return card;
}

describe("X account references for publishing", () => {
  it("publishes X cards referenced by stable xUserId", async () => {
    const account = await createConnectedXAccount();
    const card = await createXCard(account.xUserId);
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(jsonResponse({ data: { id: "tweet-stable" } }));

    const outcome = await publishCard(card);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.externalPostId).toBe("tweet-stable");
    }
  });

  it("keeps publishing legacy X cards referenced by local account row id", async () => {
    const account = await createConnectedXAccount();
    const card = await createXCard(account.id);
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ data: { id: "tweet-legacy" } })
    );

    const outcome = await publishCard(card);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.externalPostId).toBe("tweet-legacy");
    }
  });

  it("heals orphan X cards to the only active X account before publishing", async () => {
    const account = await createConnectedXAccount();
    const card = await createXCard(uniqueId("deleted-local-x-account"));
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ data: { id: "tweet-healed" } })
    );

    const outcome = await publishCard(card);
    const stored = await prisma.contentCard.findUniqueOrThrow({
      where: { id: card.id }
    });

    expect(outcome.ok).toBe(true);
    expect(stored.accountId).toBe(account.xUserId);
    expect(stored.errorCode).toBeNull();
    expect(stored.errorMessage).toBeNull();
  });

  it("stores OAuth1 media credentials for X media upload", async () => {
    const account = await createConnectedXAccount();

    await updateXTokens(account.id, {
      oauth1AccessToken: "oauth1-access-token",
      oauth1AccessTokenSecret: "oauth1-access-secret"
    });

    const tokens = await getXTokens(account.xUserId);

    expect(tokens?.oauth1).toEqual({
      accessToken: "oauth1-access-token",
      accessTokenSecret: "oauth1-access-secret"
    });
  });
});
