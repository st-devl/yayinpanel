import type { AIMessage, AIRequestOptions, AIResponse } from "@/lib/ai/types";
import type { AIProviderInterface } from "@/lib/ai/provider-interface";

export class OpenAIProvider implements AIProviderInterface {
  readonly providerType = "OPENAI";
  readonly modelName: string;

  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(config: {
    apiKey: string;
    model: string;
    baseUrl?: string;
    timeoutSeconds?: number;
  }) {
    this.apiKey = config.apiKey;
    this.modelName = config.model;
    this.baseUrl = (config.baseUrl ?? "https://api.openai.com").replace(/\/+$/, "");
    this.timeoutMs = (config.timeoutSeconds ?? 120) * 1000;
  }

  async complete(
    messages: AIMessage[],
    options?: AIRequestOptions
  ): Promise<AIResponse> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      options?.timeoutMs ?? this.timeoutMs
    );

    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.modelName,
          messages,
          max_tokens: options?.maxTokens ?? 4096,
          temperature: options?.temperature ?? 0.2,
          response_format: { type: "json_object" }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(
          body.error?.message ?? `OpenAI API hatası: ${response.status}`
        );
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
        usage: { prompt_tokens: number; completion_tokens: number };
        model: string;
      };

      return {
        content: data.choices[0]?.message?.content ?? "",
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
        model: data.model ?? this.modelName
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
