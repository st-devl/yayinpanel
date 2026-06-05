import type { AIMessage, AIRequestOptions, AIResponse } from "@/lib/ai/types";
import type { AIProviderInterface } from "@/lib/ai/provider-interface";

export class GoogleProvider implements AIProviderInterface {
  readonly providerType = "GOOGLE";
  readonly modelName: string;

  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(config: {
    apiKey: string;
    model: string;
    timeoutSeconds?: number;
  }) {
    this.apiKey = config.apiKey;
    this.modelName = config.model;
    this.timeoutMs = (config.timeoutSeconds ?? 120) * 1000;
  }

  async complete(
    messages: AIMessage[],
    options?: AIRequestOptions
  ): Promise<AIResponse> {
    const systemInstruction = messages.find((m) => m.role === "system")?.content;
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }]
      }));

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      options?.timeoutMs ?? this.timeoutMs
    );

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: systemInstruction
            ? { parts: [{ text: systemInstruction }] }
            : undefined,
          contents,
          generationConfig: {
            maxOutputTokens: options?.maxTokens ?? 4096,
            temperature: options?.temperature ?? 0.2,
            responseMimeType: "application/json"
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(
          body.error?.message ?? `Google API hatası: ${response.status}`
        );
      }

      const data = (await response.json()) as {
        candidates: Array<{
          content: { parts: Array<{ text: string }> };
        }>;
        usageMetadata: {
          promptTokenCount: number;
          candidatesTokenCount: number;
        };
      };

      const content =
        data.candidates[0]?.content?.parts?.map((p) => p.text).join("") ?? "";

      return {
        content,
        inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
        model: this.modelName
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
