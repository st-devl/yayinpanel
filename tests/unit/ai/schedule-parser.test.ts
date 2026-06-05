import { describe, expect, it } from "vitest";
import {
  parseScheduledAt,
  buildSequentialSchedule
} from "@/lib/ai/schedule-parser";

describe("parseScheduledAt", () => {
  it("returns null for null input", () => {
    expect(parseScheduledAt(null)).toBeNull();
    expect(parseScheduledAt(undefined)).toBeNull();
    expect(parseScheduledAt("")).toBeNull();
  });

  it("parses ISO date string", () => {
    const result = parseScheduledAt("2026-06-09T10:00:00+03:00");
    expect(result).toBeInstanceOf(Date);
    expect(result!.toISOString()).toBe("2026-06-09T07:00:00.000Z");
  });

  it("returns null for invalid date string", () => {
    expect(parseScheduledAt("geçersiz tarih")).toBeNull();
  });
});

describe("buildSequentialSchedule", () => {
  it("builds correct weekly schedule", () => {
    const start = new Date("2026-06-09T07:00:00.000Z");
    const dates = buildSequentialSchedule(start, 4, 7, "Europe/Istanbul");

    expect(dates).toHaveLength(4);
    expect(dates[1].getTime() - dates[0].getTime()).toBe(
      7 * 24 * 60 * 60 * 1000
    );
    expect(dates[2].getTime() - dates[1].getTime()).toBe(
      7 * 24 * 60 * 60 * 1000
    );
  });

  it("builds correct 3-day interval schedule", () => {
    const start = new Date("2026-06-09T07:00:00.000Z");
    const dates = buildSequentialSchedule(start, 3, 3, "Europe/Istanbul");

    expect(dates).toHaveLength(3);
    expect(dates[1].getTime() - dates[0].getTime()).toBe(
      3 * 24 * 60 * 60 * 1000
    );
  });

  it("returns single item for count 1", () => {
    const start = new Date("2026-06-09T07:00:00.000Z");
    const dates = buildSequentialSchedule(start, 1, 7, "Europe/Istanbul");
    expect(dates).toHaveLength(1);
    expect(dates[0]).toEqual(start);
  });
});
