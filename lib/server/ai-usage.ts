import "server-only";

import { prisma } from "@/lib/server/prisma";

export async function logUsage(data: {
  aiProviderId: string;
  batchId?: string | null;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd?: number | null;
  purpose: string;
}) {
  return prisma.aIUsageLog.create({ data });
}

export async function getMonthlyUsageSummary(
  providerId: string,
  year: number,
  month: number
) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const logs = await prisma.aIUsageLog.findMany({
    where: {
      aiProviderId: providerId,
      createdAt: { gte: start, lt: end }
    },
    select: { inputTokens: true, outputTokens: true, estimatedCostUsd: true }
  });

  return {
    totalInputTokens: logs.reduce((s, l) => s + l.inputTokens, 0),
    totalOutputTokens: logs.reduce((s, l) => s + l.outputTokens, 0),
    totalCostUsd: logs.reduce((s, l) => s + (l.estimatedCostUsd ?? 0), 0),
    requestCount: logs.length
  };
}

export async function getRecentUsageLogs(limit = 10) {
  return prisma.aIUsageLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      aiProvider: { select: { name: true, providerType: true } }
    }
  });
}

/** Bir provider'ın tüm zamanlar toplamı */
export async function getAllTimeUsage(providerId: string) {
  const logs = await prisma.aIUsageLog.findMany({
    where: { aiProviderId: providerId },
    select: { inputTokens: true, outputTokens: true, estimatedCostUsd: true }
  });

  return {
    totalInputTokens: logs.reduce((s, l) => s + l.inputTokens, 0),
    totalOutputTokens: logs.reduce((s, l) => s + l.outputTokens, 0),
    totalCostUsd: logs.reduce((s, l) => s + (l.estimatedCostUsd ?? 0), 0),
    requestCount: logs.length
  };
}
