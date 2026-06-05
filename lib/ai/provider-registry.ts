import "server-only";

import { decryptSecret } from "@/lib/security/encryption";
import { prisma } from "@/lib/server/prisma";
import type { AIProviderInterface } from "@/lib/ai/provider-interface";
import { AnthropicProvider } from "@/lib/ai/providers/anthropic";
import { GoogleProvider } from "@/lib/ai/providers/google";
import { OpenAIProvider } from "@/lib/ai/providers/openai";
import { XAIProvider } from "@/lib/ai/providers/xai";

export class AIProviderNotConfiguredError extends Error {
  constructor() {
    super(
      "Aktif bir yapay zekâ sağlayıcısı bulunamadı. Lütfen Ayarlar > Yapay Zekâ Sağlayıcıları bölümünden bir sağlayıcı ekleyin."
    );
    this.name = "AIProviderNotConfiguredError";
  }
}

export async function getActiveProvider(
  providerId?: string
): Promise<AIProviderInterface> {
  const where = providerId
    ? { id: providerId, isActive: true }
    : { isDefault: true, isActive: true };

  const provider = await prisma.aIProvider.findFirst({ where });

  if (!provider) {
    const fallback = await prisma.aIProvider.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" }
    });

    if (!fallback) {
      throw new AIProviderNotConfiguredError();
    }

    return buildProvider(fallback);
  }

  return buildProvider(provider);
}

export function buildProvider(record: {
  providerType: string;
  apiKeyEncrypted: string;
  model: string;
  baseUrl: string | null;
  timeoutSeconds: number;
}): AIProviderInterface {
  const apiKey = decryptSecret(record.apiKeyEncrypted);
  const config = {
    apiKey,
    model: record.model,
    baseUrl: record.baseUrl ?? undefined,
    timeoutSeconds: record.timeoutSeconds
  };

  switch (record.providerType) {
    case "OPENAI":
      return new OpenAIProvider(config);
    case "ANTHROPIC":
      return new AnthropicProvider(config);
    case "GOOGLE":
      return new GoogleProvider(config);
    case "XAI":
      return new XAIProvider(config);
    case "CUSTOM":
      return new OpenAIProvider(config);
    default:
      throw new Error(`Bilinmeyen provider tipi: ${record.providerType}`);
  }
}
