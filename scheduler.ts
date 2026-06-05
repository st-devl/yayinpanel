/**
 * Bagimsiz scheduler process.
 * Next.js request yasam dongusunun disinda, ayri bir process olarak calisir.
 * Calistirma: node --env-file=.env --import tsx scheduler.ts
 * Dry-run:    node --env-file=.env --import tsx scheduler.ts --dry-run
 */
import { runSchedulerTick } from "@/lib/server/scheduler-core";

const POLL_INTERVAL_MS = 60_000;
const isDryRun = process.argv.includes("--dry-run");

let stopping = false;

async function tickOnce() {
  const startedAt = new Date();
  try {
    const result = await runSchedulerTick({ dryRun: isDryRun, now: startedAt });
    console.log(
      `[scheduler] ${startedAt.toISOString()} ` +
        `claimed=${result.claimed} published=${result.published} ` +
        `retried=${result.retried} failed=${result.failed} ` +
        `manualCheck=${result.manualCheck} dryRun=${result.dryRun}`
    );
    return result;
  } catch (error) {
    console.error("[scheduler] tick error", error);
    return null;
  }
}

async function loop() {
  while (!stopping) {
    await tickOnce();
    if (stopping) break;
    await delay(POLL_INTERVAL_MS);
  }
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

function handleShutdown(signal: string) {
  console.log(`[scheduler] ${signal} alindi, kapaniyor...`);
  stopping = true;
  setTimeout(() => process.exit(0), 500).unref?.();
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

async function main() {
  if (isDryRun) {
    // Dry-run: tek sefer calistir ve cik.
    const result = await tickOnce();
    process.exit(result ? 0 : 1);
  }

  console.log("[scheduler] baslatildi, dakikalik polling aktif.");
  await loop();
}

main().catch((error) => {
  console.error("[scheduler] fatal", error);
  process.exit(1);
});
