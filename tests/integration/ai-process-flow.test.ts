import { describe, expect, it, vi, beforeEach } from "vitest";
import { processWebsiteBatch } from "@/lib/ai/content-processor";
import type { AIProviderInterface } from "@/lib/ai/provider-interface";
import type { AIMessage, AIRequestOptions, AIResponse } from "@/lib/ai/types";

const MOCK_AI_RESPONSE = JSON.stringify([
  {
    platform: "website",
    contentType: "blog_post",
    targetAccountId: "site_123",
    title: "Test Blog Yazısı",
    summary: "Bu bir test özetidir.",
    slug: "test-blog-yazisi",
    contentHtml: "<p>Test içerik.</p>",
    seoTitle: "Test SEO Başlığı",
    seoDescription: "Test meta açıklaması.",
    category: "Teknoloji",
    tags: ["test", "blog"],
    media: [],
    scheduledAt: "2026-06-16T07:00:00.000Z",
    scheduleIsInferred: true,
    confidence: 0.91,
    warnings: [],
    aiNotes: ""
  }
]);

class MockAIProvider implements AIProviderInterface {
  readonly providerType = "MOCK";
  readonly modelName = "mock-model";

  async complete(
    _messages: AIMessage[],
    _options?: AIRequestOptions
  ): Promise<AIResponse> {
    return {
      content: MOCK_AI_RESPONSE,
      inputTokens: 500,
      outputTokens: 200,
      model: "mock-model"
    };
  }
}

describe("processWebsiteBatch", () => {
  const mockProvider = new MockAIProvider();

  it("processes raw text and returns structured content", async () => {
    const result = await processWebsiteBatch({
      rawText: "# Test Blog Yazısı\n\nTest içerik metni.",
      mediaFiles: [],
      instructionText: "Gelecek pazartesi yayınla.",
      accountId: "site_123",
      timezone: "Europe/Istanbul",
      provider: mockProvider
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe("Test Blog Yazısı");
    expect(result.items[0].slug).toBe("test-blog-yazisi");
    expect(result.items[0].confidenceLevel).toBe("HIGH");
    expect(result.items[0].warnings).toHaveLength(0);
    expect(result.inputTokens).toBe(500);
    expect(result.outputTokens).toBe(200);
  });

  it("adds AMBIGUOUS_SCHEDULE warning for null scheduledAt", async () => {
    const mockProviderNullDate: AIProviderInterface = {
      providerType: "MOCK",
      modelName: "mock-model",
      complete: async () => ({
        content: JSON.stringify([
          {
            platform: "website",
            contentType: "blog_post",
            title: "Test",
            targetAccountId: "site_123",
            scheduledAt: null,
            scheduleIsInferred: false,
            confidence: 0.88,
            warnings: [],
            media: []
          }
        ]),
        inputTokens: 100,
        outputTokens: 50,
        model: "mock-model"
      })
    };

    const result = await processWebsiteBatch({
      rawText: "Test içerik",
      mediaFiles: [],
      instructionText: "",
      accountId: "site_123",
      timezone: "Europe/Istanbul",
      provider: mockProviderNullDate
    });

    expect(result.items[0].scheduledAt).toBeNull();
    expect(result.items[0].warnings).toContain("AMBIGUOUS_SCHEDULE");
  });

  it("handles media file assignments", async () => {
    const result = await processWebsiteBatch({
      rawText: "İçerik metni",
      mediaFiles: [
        { fileId: "media_001", fileName: "kapak.jpg" }
      ],
      instructionText: "",
      accountId: "site_123",
      timezone: "Europe/Istanbul",
      provider: mockProvider
    });

    expect(result.items).toHaveLength(1);
  });

  it("throws error for invalid AI response", async () => {
    const badProvider: AIProviderInterface = {
      providerType: "MOCK",
      modelName: "mock-model",
      complete: async () => ({
        content: "Bu geçerli JSON değil",
        inputTokens: 0,
        outputTokens: 0,
        model: "mock-model"
      })
    };

    await expect(
      processWebsiteBatch({
        rawText: "Test",
        mediaFiles: [],
        instructionText: "",
        accountId: "site_123",
        timezone: "Europe/Istanbul",
        provider: badProvider
      })
    ).rejects.toThrow("geçerli bir JSON");
  });
});
