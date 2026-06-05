import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/server/env";
import { requireApiUser } from "@/lib/server/api-auth";
import {
  getSchedulerQueueSnapshot,
  runSchedulerTick
} from "@/lib/server/scheduler-core";
import { readSchedulerState } from "@/lib/server/scheduler-state";

export const maxDuration = 120;

const tickSchema = z.object({
  dryRun: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional()
});

export async function GET(request: NextRequest) {
  const authResponse = await authorizeSchedulerRequest(request);
  if (authResponse) return authResponse;

  const [state, queue] = await Promise.all([
    readSchedulerState(),
    getSchedulerQueueSnapshot()
  ]);

  return NextResponse.json({ data: { queue, state } });
}

export async function POST(request: NextRequest) {
  const authResponse = await authorizeSchedulerRequest(request);
  if (authResponse) return authResponse;

  const body = await readOptionalJson(request);
  const parsed = tickSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Gecersiz scheduler istegi", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = await runSchedulerTick({
      dryRun: parsed.data.dryRun,
      limit: parsed.data.limit
    });
    const [state, queue] = await Promise.all([
      readSchedulerState(),
      getSchedulerQueueSnapshot()
    ]);

    return NextResponse.json({ data: { queue, result, state } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Scheduler calistirilamadi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function authorizeSchedulerRequest(request: NextRequest) {
  const env = getEnv();
  const configuredSecret = env.SCHEDULER_SECRET.trim();
  const suppliedSecret =
    request.headers.get("x-scheduler-secret") ??
    readBearerToken(request.headers.get("authorization"));

  if (
    configuredSecret &&
    suppliedSecret &&
    timingSafeStringEqual(configuredSecret, suppliedSecret)
  ) {
    return null;
  }

  const auth = await requireApiUser();
  return auth.response ?? null;
}

function readBearerToken(header: string | null) {
  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

async function readOptionalJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}
