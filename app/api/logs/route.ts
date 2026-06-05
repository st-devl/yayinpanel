import { NextRequest, NextResponse } from "next/server";
import { Platform, Prisma, PublishLogStatus } from "@prisma/client";
import { requireApiUser } from "@/lib/server/api-auth";
import { prisma } from "@/lib/server/prisma";

function parseDate(value: string | null) {
  if (!value) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseToDate(value: string | null) {
  const date = parseDate(value);

  if (!date || value?.includes("T")) {
    return date;
  }

  const end = new Date(date);
  end.setDate(end.getDate() + 1);
  return end;
}

function serializeDate<T extends { createdAt: Date }>(row: T) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString()
  };
}

async function getAccountLabels(
  logs: Array<{ platform: Platform; accountId: string | null }>
) {
  const idsByPlatform = logs.reduce(
    (acc, log) => {
      if (log.accountId) {
        acc[log.platform].add(log.accountId);
      }
      return acc;
    },
    {
      [Platform.INSTAGRAM]: new Set<string>(),
      [Platform.X]: new Set<string>(),
      [Platform.WORDPRESS]: new Set<string>(),
      [Platform.CUSTOM_SITE]: new Set<string>()
    }
  );

  const [instagram, x, wordpress, customSites] = await Promise.all([
    prisma.instagramAccount.findMany({
      where: { id: { in: [...idsByPlatform[Platform.INSTAGRAM]] } },
      select: { accountName: true, id: true, username: true }
    }),
    prisma.xAccount.findMany({
      where: { id: { in: [...idsByPlatform[Platform.X]] } },
      select: { accountName: true, id: true, username: true }
    }),
    prisma.wordPressSite.findMany({
      where: { id: { in: [...idsByPlatform[Platform.WORDPRESS]] } },
      select: { id: true, name: true }
    }),
    prisma.customSite.findMany({
      where: { id: { in: [...idsByPlatform[Platform.CUSTOM_SITE]] } },
      select: { id: true, name: true }
    })
  ]);

  return new Map<string, string>([
    ...instagram.map(
      (account) =>
        [
          `${Platform.INSTAGRAM}:${account.id}`,
          `${account.accountName} (@${account.username})`
        ] as const
    ),
    ...x.map(
      (account) =>
        [
          `${Platform.X}:${account.id}`,
          `${account.accountName} (@${account.username})`
        ] as const
    ),
    ...wordpress.map(
      (site) => [`${Platform.WORDPRESS}:${site.id}`, site.name] as const
    ),
    ...customSites.map(
      (site) => [`${Platform.CUSTOM_SITE}:${site.id}`, site.name] as const
    )
  ]);
}

export async function GET(request: NextRequest) {
  const auth = await requireApiUser();
  if (auth.response) return auth.response;

  const { searchParams } = request.nextUrl;
  const platform = searchParams.get("platform");
  const status = searchParams.get("status");
  const action = searchParams.get("action")?.trim();
  const from = parseDate(searchParams.get("from"));
  const to = parseToDate(searchParams.get("to"));
  const take = Math.min(Number(searchParams.get("take") ?? 100) || 100, 200);

  const where: Prisma.PublishLogWhereInput = {
    action: action || undefined,
    platform:
      platform && platform in Platform ? (platform as Platform) : undefined,
    status:
      status && status in PublishLogStatus
        ? (status as PublishLogStatus)
        : undefined
  };

  if (from || to) {
    where.createdAt = {
      gte: from,
      lt: to
    };
  }

  const [logs, actions] = await Promise.all([
    prisma.publishLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take,
      include: {
        contentCard: {
          select: {
            externalPostUrl: true,
            id: true,
            status: true,
            text: true
          }
        }
      }
    }),
    prisma.publishLog.groupBy({
      by: ["action"],
      orderBy: { action: "asc" }
    })
  ]);
  const labels = await getAccountLabels(logs);

  return NextResponse.json({
    actions: actions.map((item) => item.action),
    data: logs.map((log) => ({
      ...serializeDate(log),
      accountLabel: log.accountId
        ? (labels.get(`${log.platform}:${log.accountId}`) ?? log.accountId)
        : "-"
    }))
  });
}
