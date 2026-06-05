import { OpenAIProvider } from "@/lib/ai/providers/openai";

export class XAIProvider extends OpenAIProvider {
  constructor(config: {
    apiKey: string;
    model: string;
    timeoutSeconds?: number;
  }) {
    super({
      ...config,
      baseUrl: "https://api.x.ai"
    });
    (this as { providerType: string }).providerType = "XAI";
  }
}
