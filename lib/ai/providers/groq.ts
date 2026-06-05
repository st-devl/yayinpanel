import { OpenAIProvider } from "@/lib/ai/providers/openai";

export class GroqProvider extends OpenAIProvider {
  constructor(config: {
    apiKey: string;
    model: string;
    timeoutSeconds?: number;
  }) {
    super({
      ...config,
      baseUrl: "https://api.groq.com/openai"
    });
    (this as { providerType: string }).providerType = "GROQ";
  }
}
