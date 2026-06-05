import type { AIMessage, AIRequestOptions, AIResponse } from "@/lib/ai/types";

export interface AIProviderInterface {
  readonly providerType: string;
  readonly modelName: string;
  complete(
    messages: AIMessage[],
    options?: AIRequestOptions
  ): Promise<AIResponse>;
}
