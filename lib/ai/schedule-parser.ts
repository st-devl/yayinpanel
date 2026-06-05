import type { ParsedSchedule } from "@/lib/ai/types";

/**
 * AI'ın döndürdüğü scheduledAt string'ini Date'e çevirir.
 * null ise schedule belirsiz demektir — kullanıcıdan onay istenir.
 */
export function parseScheduledAt(value: string | null | undefined): Date | null {
  if (!value) return null;

  const date = new Date(value);

  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * AI çıktısındaki items dizisine schedule bilgisini uygular.
 * scheduleIsInferred=true olan ve scheduledAt=null olan itemlar
 * kullanıcıya "tarih belirsiz" uyarısıyla gösterilir.
 */
export function applyScheduleToItems(
  items: Array<{
    scheduledAt: string | null;
    scheduleIsInferred?: boolean;
    warnings: string[];
  }>
): ParsedSchedule[] {
  return items.map((item) => {
    const date = parseScheduledAt(item.scheduledAt);

    if (!date && !item.warnings.includes("AMBIGUOUS_SCHEDULE")) {
      item.warnings.push("AMBIGUOUS_SCHEDULE");
    }

    return {
      scheduledAt: date,
      isInferred: item.scheduleIsInferred ?? false
    };
  });
}

/**
 * Birden fazla item için ardışık haftalık/günlük schedule uygular.
 * AI tarihi hesaplayamazsa bu yardımcı kullanılabilir.
 */
export function buildSequentialSchedule(
  startDate: Date,
  itemCount: number,
  intervalDays: number,
  timezone: string
): Date[] {
  const dates: Date[] = [];
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });

  let current = new Date(startDate);

  for (let i = 0; i < itemCount; i++) {
    dates.push(new Date(current));
    current = new Date(current.getTime() + intervalDays * 24 * 60 * 60 * 1000);
  }

  void formatter;
  return dates;
}
