import "server-only";

import { prisma } from "@/lib/server/prisma";

export const SCHEDULER_STATE_SETTING_KEY = "__internal_scheduler_state_v1";

export type SchedulerTickSnapshot = {
  claimed: number;
  published: number;
  retried: number;
  failed: number;
  manualCheck: number;
  dryRun: boolean;
};

export type SchedulerState = {
  lastStartedAt: string | null;
  lastFinishedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
  lastResult: SchedulerTickSnapshot | null;
};

const emptyState: SchedulerState = {
  lastErrorAt: null,
  lastErrorMessage: null,
  lastFinishedAt: null,
  lastResult: null,
  lastStartedAt: null,
  lastSuccessAt: null
};

export async function readSchedulerState(): Promise<SchedulerState | null> {
  const row = await prisma.setting.findUnique({
    where: { key: SCHEDULER_STATE_SETTING_KEY }
  });

  if (!row) {
    return null;
  }

  return parseSchedulerState(row.value);
}

export async function recordSchedulerTickStart(startedAt: Date): Promise<void> {
  const current = (await readSchedulerState()) ?? emptyState;
  await writeSchedulerState({
    ...current,
    lastStartedAt: startedAt.toISOString()
  });
}

export async function recordSchedulerTickSuccess(
  result: SchedulerTickSnapshot,
  finishedAt: Date
): Promise<void> {
  const current = (await readSchedulerState()) ?? emptyState;
  const finishedAtIso = finishedAt.toISOString();

  await writeSchedulerState({
    ...current,
    lastFinishedAt: finishedAtIso,
    lastResult: result,
    lastSuccessAt: finishedAtIso
  });
}

export async function recordSchedulerTickFailure(
  error: unknown,
  finishedAt: Date
): Promise<void> {
  const current = (await readSchedulerState()) ?? emptyState;
  const finishedAtIso = finishedAt.toISOString();

  await writeSchedulerState({
    ...current,
    lastErrorAt: finishedAtIso,
    lastErrorMessage:
      error instanceof Error ? error.message : "Scheduler tick failed",
    lastFinishedAt: finishedAtIso
  });
}

async function writeSchedulerState(state: SchedulerState): Promise<void> {
  await prisma.setting.upsert({
    where: { key: SCHEDULER_STATE_SETTING_KEY },
    update: { value: JSON.stringify(state) },
    create: { key: SCHEDULER_STATE_SETTING_KEY, value: JSON.stringify(state) }
  });
}

function parseSchedulerState(value: string): SchedulerState | null {
  try {
    const parsed = JSON.parse(value) as Partial<SchedulerState>;
    return {
      lastErrorAt: parsed.lastErrorAt ?? null,
      lastErrorMessage: parsed.lastErrorMessage ?? null,
      lastFinishedAt: parsed.lastFinishedAt ?? null,
      lastResult: parsed.lastResult ?? null,
      lastStartedAt: parsed.lastStartedAt ?? null,
      lastSuccessAt: parsed.lastSuccessAt ?? null
    };
  } catch {
    return null;
  }
}
