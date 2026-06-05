import { afterEach, describe, expect, it, vi } from "vitest";
import { XPublisher } from "@/lib/publishers/x-publisher";
import { WordPressPublisher } from "@/lib/publishers/wordpress-publisher";
import { runPublish } from "@/lib/publishers";
import type { PublishContext } from "@/lib/publishers/types";

afterEach(() => {
  vi.restoreAllMocks();
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

const xContext: PublishContext = {
  card: {
    id: "card-1",
    platform: "X",
    accountId: "acc-1",
    text: "Merhaba dunya",
    mediaFileId: null,
    platformData: { hasMedia: false }
  },
  credentials: { accessToken: "token" }
};

describe("XPublisher (mock API)", () => {
  it("creates a tweet and returns external id/url", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ data: { id: "1750000000000000000" } })
    );

    const result = await new XPublisher().publish(xContext);

    expect(result.status).toBe("PUBLISHED");
    expect(result.externalPostId).toBe("1750000000000000000");
    expect(result.externalPostUrl).toContain("1750000000000000000");
  });

  it("classifies 401 as AUTH error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ detail: "Unauthorized" }, 401)
    );

    await expect(new XPublisher().publish(xContext)).rejects.toMatchObject({
      kind: "AUTH",
      code: "X_TWEET_FAILED"
    });
  });

  it("classifies 429 as TRANSIENT error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ detail: "Too Many Requests" }, 429)
    );

    await expect(new XPublisher().publish(xContext)).rejects.toMatchObject({
      kind: "TRANSIENT"
    });
  });
});

describe("runPublish 401 refresh + retry", () => {
  it("refreshes credentials once on AUTH error and retries", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ detail: "Unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ data: { id: "999" } }));

    const refreshCredentials = vi
      .fn()
      .mockResolvedValue({ accessToken: "fresh-token" });

    const outcome = await runPublish(xContext, { refreshCredentials });

    expect(refreshCredentials).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.externalPostId).toBe("999");
    }
  });

  it("returns the error when refresh is unavailable", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ detail: "Unauthorized" }, 401)
    );

    const outcome = await runPublish(xContext);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error.kind).toBe("AUTH");
    }
  });
});

describe("WordPressPublisher (mock API)", () => {
  it("publishes a post via REST API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      jsonResponse({ id: 42, link: "https://blog.example.com/?p=42" })
    );

    const result = await new WordPressPublisher().publish({
      card: {
        id: "card-2",
        platform: "WORDPRESS",
        accountId: "site-1",
        text: null,
        mediaFileId: null,
        platformData: {
          title: "Baslik",
          slug: "baslik",
          contentHtml: "<p>icerik</p>"
        }
      },
      credentials: {
        accessToken: "",
        wordpress: {
          baseUrl: "https://blog.example.com",
          username: "admin",
          applicationPassword: "app pass word"
        }
      }
    });

    expect(result.externalPostId).toBe("42");
    expect(result.externalPostUrl).toContain("p=42");
  });
});
