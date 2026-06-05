import "server-only";

import {
  ConnectionStatus,
  ContentStatus,
  Platform,
  PublishLogStatus
} from "@prisma/client";
import { prisma } from "@/lib/server/prisma";
import { utcToZonedDate } from "@/lib/timezone";

export type DashboardMetrics = {
  todayScheduled: number;
  scheduled: number;
  published: number;
  failed: number;
  manualCheck: number;
};

export type AccountSummary = {
  platform: Platform;
  total: number;
  connected: number;
  needsAttention: number;
};

function istanbulDayRange() {
  const now = new Date();
  const zoned = utcToZonedDate(now);
  const start = new Date(zoned);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  // zoned tarihler UTC offset farkini iceriyor; basit gun araligi yaklasimi.
  return { start, end };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const { start, end } = istanbulDayRange();

  const [todayScheduled, scheduled, published, failed, manualCheck] =
    await Promise.all([
      prisma.contentCard.count({
        where: {
          status: ContentStatus.SCHEDULED,
          scheduledAt: { gte: start, lt: end }
        }
      }),
      prisma.contentCard.count({ where: { status: ContentStatus.SCHEDULED } }),
      prisma.contentCard.count({ where: { status: ContentStatus.PUBLISHED } }),
      prisma.contentCard.count({ where: { status: ContentStatus.FAILED } }),
      prisma.contentCard.count({
        where: { status: ContentStatus.MANUAL_CHECK_REQUIRED }
      })
    ]);

  return { todayScheduled, scheduled, published, failed, manualCheck };
}

export async function getAccountSummaries(): Promise<AccountSummary[]> {
  const [instagram, x, wordpress] = await Promise.all([
    prisma.instagramAccount.groupBy({
      by: ["connectionStatus"],
      _count: true
    }),
    prisma.xAccount.groupBy({ by: ["connectionStatus"], _count: true }),
    prisma.wordPressSite.groupBy({ by: ["connectionStatus"], _count: true })
  ]);

  return [
    summarize(Platform.INSTAGRAM, instagram),
    summarize(Platform.X, x),
    summarize(Platform.WORDPRESS, wordpress)
  ];
}

function summarize(
  platform: Platform,
  groups: { connectionStatus: ConnectionStatus; _count: number }[]
): AccountSummary {
  let total = 0;
  let connected = 0;

  for (const group of groups) {
    total += group._count;
    if (group.connectionStatus === ConnectionStatus.CONNECTED) {
      connected += group._count;
    }
  }

  return { platform, total, connected, needsAttention: total - connected };
}

/** Token suresi yaklasan veya hatali hesaplari uyari olarak dondurur. */
export async function getConnectionAlerts() {
  const soon = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3);
  const problemStatuses: ConnectionStatus[] = [
    ConnectionStatus.NEEDS_RECONNECT,
    ConnectionStatus.TOKEN_EXPIRED,
    ConnectionStatus.PERMISSION_MISSING,
    ConnectionStatus.RATE_LIMITED,
    ConnectionStatus.FAILED
  ];

  const [instagram, x, wordpress] = await Promise.all([
    prisma.instagramAccount.findMany({
      where: {
        OR: [
          { connectionStatus: { in: problemStatuses } },
          { tokenExpiresAt: { lte: soon } }
        ]
      },
      select: {
        id: true,
        accountName: true,
        connectionStatus: true,
        lastError: true,
        tokenExpiresAt: true
      }
    }),
    prisma.xAccount.findMany({
      where: {
        OR: [
          { connectionStatus: { in: problemStatuses } },
          { tokenExpiresAt: { lte: soon } }
        ]
      },
      select: {
        id: true,
        accountName: true,
        connectionStatus: true,
        lastError: true,
        tokenExpiresAt: true
      }
    }),
    prisma.wordPressSite.findMany({
      where: { connectionStatus: { in: problemStatuses } },
      select: {
        id: true,
        name: true,
        connectionStatus: true,
        lastError: true
      }
    })
  ]);

  return [
    ...instagram.map((a) => ({
      platform: Platform.INSTAGRAM,
      name: a.accountName,
      status: a.connectionStatus,
      message: a.lastError
    })),
    ...x.map((a) => ({
      platform: Platform.X,
      name: a.accountName,
      status: a.connectionStatus,
      message: a.lastError
    })),
    ...wordpress.map((s) => ({
      platform: Platform.WORDPRESS,
      name: s.name,
      status: s.connectionStatus,
      message: s.lastError
    }))
  ];
}

export async function getRecentPublishActivity(take = 5) {
  const [recentSuccess, recentErrors] = await Promise.all([
    prisma.publishLog.findMany({
      where: { status: PublishLogStatus.OK },
      orderBy: { createdAt: "desc" },
      take,
      include: { contentCard: { select: { externalPostUrl: true } } }
    }),
    prisma.publishLog.findMany({
      where: { status: PublishLogStatus.ERROR },
      orderBy: { createdAt: "desc" },
      take
    })
  ]);

  return { recentSuccess, recentErrors };
}
