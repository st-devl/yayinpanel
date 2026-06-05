import type { AIMessage, AIRequestOptions, AIResponse } from "@/lib/ai/types";
import type { AIProviderInterface } from "@/lib/ai/provider-interface";

export class AnthropicProvider implements AIProviderInterface {
  readonly providerType = "ANTHROPIC";
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
    const systemMessage = messages.find((m) => m.role === "system")?.content;
    const userMessages = messages.filter((m) => m.role !== "system");

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      options?.timeoutMs ?? this.timeoutMs
    );

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: this.modelName,
          max_tokens: options?.maxTokens ?? 4096,
          temperature: options?.temperature ?? 0.2,
          system: systemMessage,
          messages: userMessages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          tools: [
            {
              name: "output_json",
              description: "Yapılandırılmış JSON çıktısını döndür",
              input_schema: {
                type: "object",
                properties: {
                  result: { type: "string", description: "JSON string" }
                },
                required: ["result"]
              }
            }
          ],
          tool_choice: { type: "tool", name: "output_json" }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };
        throw new Error(
          body.error?.message ?? `Anthropic API hatası: ${response.status}`
        );
      }

      const data = (await response.json()) as {
        content: Array<{
          type: string;
          text?: string;
          input?: { result?: string };
        }>;
        usage: { input_tokens: number; output_tokens: number };
        model: string;
      };

      const toolBlock = data.content.find((b) => b.type === "tool_use");
      const textBlock = data.content.find((b) => b.type === "text");
      const content =
        toolBlock?.input?.result ?? textBlock?.text ?? "";

      return {
        content,
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
        model: data.model ?? this.modelName
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
