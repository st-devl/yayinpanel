import { describe, expect, it, vi } from "vitest";
import { parseFileToText, isSupportedDocMimeType } from "@/lib/ai/file-parser";

describe("parseFileToText", () => {
  it("parses plain text", async () => {
    const buf = Buffer.from("Merhaba dünya", "utf-8");
    const result = await parseFileToText(buf, "text/plain");
    expect(result).toBe("Merhaba dünya");
  });

  it("parses markdown", async () => {
    const buf = Buffer.from("# Başlık\n\nİçerik", "utf-8");
    const result = await parseFileToText(buf, "text/markdown");
    expect(result).toBe("# Başlık\n\nİçerik");
  });

  it("throws for unsupported mime type", async () => {
    const buf = Buffer.from("data");
    await expect(parseFileToText(buf, "image/jpeg")).rejects.toThrow(
      "Desteklenmeyen dosya türü"
    );
  });

  it("identifies supported doc types", () => {
    expect(isSupportedDocMimeType("text/plain")).toBe(true);
    expect(isSupportedDocMimeType("text/markdown")).toBe(true);
    expect(
      isSupportedDocMimeType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(true);
    expect(isSupportedDocMimeType("image/jpeg")).toBe(false);
  });

  it("parses docx with mammoth mock", async () => {
    vi.mock("mammoth", () => ({
      extractRawText: vi.fn().mockResolvedValue({
        value: "Word içeriği",
        messages: []
      })
    }));

    const buf = Buffer.from("mock-docx-data");
    const result = await parseFileToText(
      buf,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(result).toBe("Word içeriği");
  });
});
