import "server-only";

import { AIProviderType, Prisma } from "@prisma/client";
import { decryptSecret, encryptSecret } from "@/lib/security/encryption";
import { prisma } from "@/lib/server/prisma";

export const aiProviderSafeSelect = {
  id: true,
  name: true,
  providerType: true,
  model: true,
  baseUrl: true,
  maxTokens: true,
  timeoutSeconds: true,
  monthlyBudgetUsd: true,
  isActive: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.AIProviderSelect;

export type SafeAIProvider = Prisma.AIProviderGetPayload<{
  select: typeof aiProviderSafeSelect;
}>;

export type CreateAIProviderInput = {
  name: string;
  providerType: AIProviderType;
  apiKey: string;
  model: string;
  baseUrl?: string | null;
  maxTokens?: number | null;
  timeoutSeconds?: number;
  monthlyBudgetUsd?: number | null;
  isActive?: boolean;
  isDefault?: boolean;
};

export async function createAIProvider(
  input: CreateAIProviderInput
): Promise<SafeAIProvider> {
  const apiKey = input.apiKey.trim();

  if (!apiKey) {
    throw new Error("API anahtarı zorunludur");
  }

  if (input.isDefault) {
    await prisma.aIProvider.updateMany({ data: { isDefault: false } });
  }

  const isFirstProvider = (await prisma.aIProvider.count()) === 0;

  return prisma.aIProvider.create({
    data: {
      name: input.name.trim(),
      providerType: input.providerType,
      apiKeyEncrypted: encryptSecret(apiKey),
      model: input.model.trim(),
      baseUrl: input.baseUrl?.trim() || null,
      maxTokens: input.maxTokens ?? null,
      timeoutSeconds: input.timeoutSeconds ?? 120,
      monthlyBudgetUsd: input.monthlyBudgetUsd ?? null,
      isActive: input.isActive ?? true,
      isDefault: input.isDefault ?? isFirstProvider
    },
    select: aiProviderSafeSelect
  });
}

export async function updateAIProvider(
  id: string,
  input: Partial<CreateAIProviderInput>
): Promise<SafeAIProvider> {
  if (input.isDefault) {
    await prisma.aIProvider.updateMany({
      where: { id: { not: id } },
      data: { isDefault: false }
    });
  }

  return prisma.aIProvider.update({
    where: { id },
    data: {
      name: input.name?.trim(),
      providerType: input.providerType,
      apiKeyEncrypted: input.apiKey
        ? encryptSecret(input.apiKey.trim())
        : undefined,
      model: input.model?.trim(),
      baseUrl:
        input.baseUrl !== undefined
          ? input.baseUrl?.trim() || null
          : undefined,
      maxTokens: input.maxTokens,
      timeoutSeconds: input.timeoutSeconds,
      monthlyBudgetUsd: input.monthlyBudgetUsd,
      isActive: input.isActive,
      isDefault: input.isDefault
    },
    select: aiProviderSafeSelect
  });
}

export async function deleteAIProvider(id: string): Promise<void> {
  const count = await prisma.aIProvider.count();

  if (count <= 1) {
    throw new Error("Son sağlayıcı silinemez");
  }

  const provider = await prisma.aIProvider.findUnique({ where: { id } });

  if (!provider) {
    throw new Error("Sağlayıcı bulunamadı");
  }

  await prisma.aIProvider.delete({ where: { id } });

  if (provider.isDefault) {
    const next = await prisma.aIProvider.findFirst({ orderBy: { createdAt: "asc" } });
    if (next) {
      await prisma.aIProvider.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }
}

export async function getAIProviders(): Promise<SafeAIProvider[]> {
  return prisma.aIProvider.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    select: aiProviderSafeSelect
  });
}

export async function getAIProviderCredentials(id: string) {
  const provider = await prisma.aIProvider.findUnique({ where: { id } });

  if (!provider) return null;

  return {
    ...provider,
    apiKey: decryptSecret(provider.apiKeyEncrypted)
  };
}

export async function setDefaultAIProvider(id: string): Promise<SafeAIProvider> {
  await prisma.aIProvider.updateMany({ data: { isDefault: false } });

  return prisma.aIProvider.update({
    where: { id },
    data: { isDefault: true },
    select: aiProviderSafeSelect
  });
}

export async function getDefaultAIProvider(): Promise<SafeAIProvider | null> {
  return prisma.aIProvider.findFirst({
    where: { isDefault: true, isActive: true },
    select: aiProviderSafeSelect
  });
}
