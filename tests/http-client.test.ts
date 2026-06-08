import { describe, expect, it } from "vitest";
import { readJsonResponse } from "@/lib/client/http";

describe("readJsonResponse", () => {
  it("reads JSON responses normally", async () => {
    const response = Response.json({ data: { id: "1" } });

    await expect(
      readJsonResponse<{ data?: { id: string }; error?: string }>(response)
    ).resolves.toEqual({ data: { id: "1" } });
  });

  it("turns empty responses into a usable error payload", async () => {
    const response = new Response("", { status: 500 });

    await expect(
      readJsonResponse<{ error?: string }>(response)
    ).resolves.toMatchObject({
      error: "Sunucu bos yanit dondurdu (HTTP 500)."
    });
  });

  it("turns non-JSON responses into a usable error payload", async () => {
    const response = new Response("<html>Error</html>", { status: 502 });

    await expect(
      readJsonResponse<{ error?: string }>(response)
    ).resolves.toMatchObject({
      error: "Sunucudan zamaninda yanit alinamadi. Biraz sonra tekrar deneyin."
    });
  });
});
