import { afterEach, describe, expect, it, vi } from "vitest";
import { sendTelegramNotification } from "@/lib/server/telegram";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("telegram notifications", () => {
  it("skips and warns when token/chat id missing", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "");
    vi.stubEnv("TELEGRAM_CHAT_ID", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await sendTelegramNotification({
      kind: "PUBLISH_FAILED",
      detail: "test"
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toContain("TELEGRAM_BOT_TOKEN");
    expect(warn).toHaveBeenCalled();
  });

  it("sends a message when configured", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", "bot-token");
    vi.stubEnv("TELEGRAM_CHAT_ID", "12345");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response('{"ok":true}', { status: 200 }));

    const result = await sendTelegramNotification({
      kind: "PUBLISH_SUCCESS",
      detail: "ok",
      action: "harekete gec"
    });

    expect(result.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/botbot-token/sendMessage");
  });
});
