import { ContentStatus, Platform } from "@prisma/client";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import {
  cancelContentCard,
  createContentCard,
  deleteContentCard,
  listContentCards,
  resolveManualCheck,
  retryContentCard,
  scheduleContentCard,
  updateContentCard
} from "@/lib/server/content-cards";
import { PublishError } from "@/lib/publishers/errors";
import { publishCard } from "@/lib/server/publish-runner";
import {
  MAX_RETRY_COUNT,
  computeBackoffSeconds,
  runSchedulerTick
} from "@/lib/server/scheduler-core";
import { prisma } from "@/lib/server/prisma";

vi.mock("@/lib/server/publish-runner", () => ({
  publishCard: vi.fn()
}));

vi.mock("@/lib/server/telegram", () => ({
  sendTelegramNotification: vi.fn().mockResolvedValue({ ok: true })
}));

const publishCardMock = vi.mocked(publishCard);
const createdCardIds = new Set<string>();
const testAccountIds = new Set<string>();

function uniqueAccountId(label: string) {
  const id = `test-${label}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  testAccountIds.add(id);
  return id;
}

async function createScheduledCard(input?: {
  accountId?: string;
  retryCount?: number;
  scheduledAt?: Date;
  status?: ContentStatus;
}) {
  const card = await prisma.contentCard.create({
    data: {
      accountId: input?.accountId ?? uniqueAccountId("scheduler"),
      accountType: "X",
      platform: Platform.X,
      platformData: JSON.stringify({ hasMedia: false }),
      retryCount: input?.retryCount ?? 0,
      scheduledAt: input?.scheduledAt ?? new Date("2026-06-05T08:00:00.000Z"),
      status: input?.status ?? ContentStatus.SCHEDULED,
      text: "Scheduler integration test"
    }
  });
  createdCardIds.add(card.id);
  return card;
}

async function cleanupTestRows() {
  const ids = [...createdCardIds];
  const accountIds = [...testAccountIds];
  const filters = [
    ...(ids.length ? [{ id: { in: ids } }] : []),
    ...(accountIds.length ? [{ accountId: { in: accountIds } }] : [])
  ];
  const logFilters = [
    ...(ids.length ? [{ contentCardId: { in: ids } }] : []),
    ...(accountIds.length ? [{ accountId: { in: accountIds } }] : [])
  ];

  if (filters.length) {
    await prisma.publishLog.deleteMany({
      where: { OR: logFilters }
    });
    await prisma.contentCard.deleteMany({
      where: { OR: filters }
    });
  }

  createdCardIds.clear();
  testAccountIds.clear();
}

afterEach(async () => {
  vi.clearAllMocks();
  await cleanupTestRows();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("content card integration actions", () => {
  it("creates, filters, updates, schedules, cancels, retries, resolves manual check and deletes a card", async () => {
    const accountId = uniqueAccountId("crud");
    const created = await createContentCard({
      accountId,
      accountType: "X",
      platform: Platform.X,
      platformData: { hasMedia: false },
      status: ContentStatus.DRAFT,
      text: "İlk metin"
    });
    createdCardIds.add(created.id);

    const draftCards = await listContentCards({
      accountId,
      platform: Platform.X,
      status: ContentStatus.DRAFT
    });
    expect(draftCards.map((card) => card.id)).toContain(created.id);

    const updated = await updateContentCard(created.id, {
      text: "Güncel metin"
    });
    expect(updated.text).toBe("Güncel metin");

    const scheduledAt = new Date("2026-06-05T09:00:00.000Z");
    const scheduled = await scheduleContentCard(created.id, scheduledAt);
    expect(scheduled.status).toBe(ContentStatus.SCHEDULED);
    expect(scheduled.scheduledAt?.toISOString()).toBe(
      scheduledAt.toISOString()
    );

    const canceled = await cancelContentCard(created.id);
    expect(canceled.ok).toBe(true);
    if (canceled.ok) {
      expect(canceled.card.status).toBe(ContentStatus.CANCELED);
      expect(canceled.card.scheduledAt).toBeNull();
    }

    const retried = await retryContentCard(created.id);
    expect(retried.status).toBe(ContentStatus.SCHEDULED);
    expect(retried.retryCount).toBe(0);

    await prisma.contentCard.update({
      where: { id: created.id },
      data: {
        manualCheckReason: "Integration manual check",
        status: ContentStatus.MANUAL_CHECK_REQUIRED
      }
    });
    const resolved = await resolveManualCheck(created.id, true);
    expect(resolved.status).toBe(ContentStatus.SCHEDULED);
    expect(resolved.manualCheckReason).toBeNull();

    const deleted = await deleteContentCard(created.id);
    expect(deleted.ok).toBe(true);
    createdCardIds.delete(created.id);

    const afterDelete = await prisma.contentCard.findUnique({
      where: { id: created.id }
    });
    expect(afterDelete).toBeNull();
  });
});

describe("scheduler integration flow", () => {
  it("atomically claims a due card and marks it published on successful publish", async () => {
    const now = new Date("2026-06-05T09:00:00.000Z");
    const card = await createScheduledCard({
      scheduledAt: new Date("2026-06-05T08:59:00.000Z")
    });
    publishCardMock.mockResolvedValue({
      ok: true,
      result: {
        externalPostId: "external-1",
        externalPostUrl: "https://x.com/test/status/external-1",
        status: "PUBLISHED"
      }
    });

    const result = await runSchedulerTick({ limit: 1, now });
    const stored = await prisma.contentCard.findUnique({
      where: { id: card.id }
    });

    expect(result).toMatchObject({
      claimed: 1,
      dryRun: false,
      published: 1
    });
    expect(publishCardMock).toHaveBeenCalledOnce();
    expect(stored?.status).toBe(ContentStatus.PUBLISHED);
    expect(stored?.externalPostId).toBe("external-1");
  });

  it("requeues transient publish errors with exponential backoff", async () => {
    const now = new Date("2026-06-05T09:00:00.000Z");
    const card = await createScheduledCard({
      retryCount: 0,
      scheduledAt: new Date("2026-06-05T08:58:00.000Z")
    });
    publishCardMock.mockResolvedValue({
      error: new PublishError("TRANSIENT", "RATE_LIMIT", "Rate limit"),
      ok: false
    });

    const result = await runSchedulerTick({ limit: 1, now });
    const stored = await prisma.contentCard.findUnique({
      where: { id: card.id }
    });

    expect(result.retried).toBe(1);
    expect(stored?.status).toBe(ContentStatus.SCHEDULED);
    expect(stored?.retryCount).toBe(1);
    expect(stored?.errorCode).toBe("RATE_LIMIT");
    expect(stored?.nextAttemptAt?.toISOString()).toBe(
      new Date(now.getTime() + computeBackoffSeconds(1) * 1000).toISOString()
    );
  });

  it("marks retry-exhausted transient errors as failed", async () => {
    const now = new Date("2026-06-05T09:00:00.000Z");
    const card = await createScheduledCard({
      retryCount: MAX_RETRY_COUNT - 1,
      scheduledAt: new Date("2026-06-05T08:58:00.000Z")
    });
    publishCardMock.mockResolvedValue({
      error: new PublishError("TRANSIENT", "TIMEOUT", "Timeout"),
      ok: false
    });

    const result = await runSchedulerTick({ limit: 1, now });
    const stored = await prisma.contentCard.findUnique({
      where: { id: card.id }
    });

    expect(result.failed).toBe(1);
    expect(stored?.status).toBe(ContentStatus.FAILED);
    expect(stored?.errorCode).toBe("TIMEOUT");
  });

  it("moves stuck publishing cards to manual check and writes a warning log", async () => {
    const now = new Date("2026-06-05T09:00:00.000Z");
    const card = await createScheduledCard({
      scheduledAt: new Date("2026-06-05T08:00:00.000Z"),
      status: ContentStatus.PUBLISHING
    });
    await prisma.contentCard.update({
      where: { id: card.id },
      data: {
        publishingStartedAt: new Date("2026-06-05T08:40:00.000Z")
      }
    });

    const result = await runSchedulerTick({ limit: 1, now });
    const stored = await prisma.contentCard.findUnique({
      where: { id: card.id }
    });
    const log = await prisma.publishLog.findFirst({
      where: { contentCardId: card.id, action: "manual_check" }
    });

    expect(result.manualCheck).toBe(1);
    expect(stored?.status).toBe(ContentStatus.MANUAL_CHECK_REQUIRED);
    expect(stored?.manualCheckReason).toContain("Yayin cok uzun surdu");
    expect(log?.status).toBe("WARNING");
  });
});
