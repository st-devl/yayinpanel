import { describe, expect, it } from "vitest";
import {
  buildBulkSchedule,
  formatPanelDateTime,
  utcToZonedDateTimeInput,
  zonedDateTimeInputToUtc,
  zonedInputToUtc
} from "@/lib/timezone";

describe("timezone helpers", () => {
  it("converts Europe/Istanbul date and time inputs to UTC", () => {
    expect(zonedInputToUtc("2026-06-05", "09:30").toISOString()).toBe(
      "2026-06-05T06:30:00.000Z"
    );
  });

  it("converts datetime-local input values to UTC", () => {
    expect(zonedDateTimeInputToUtc("2026-06-05T22:15").toISOString()).toBe(
      "2026-06-05T19:15:00.000Z"
    );
  });

  it("formats UTC dates for the panel timezone", () => {
    expect(formatPanelDateTime(new Date("2026-06-05T06:30:00.000Z"))).toBe(
      "05.06.2026 09:30"
    );
  });

  it("creates datetime-local values from UTC dates", () => {
    expect(utcToZonedDateTimeInput(new Date("2026-06-05T06:30:00.000Z"))).toBe(
      "2026-06-05T09:30"
    );
  });

  it("builds daily schedules while skipping weekends", () => {
    const result = buildBulkSchedule({
      count: 4,
      frequency: "daily",
      skipWeekends: true,
      startDate: "2026-06-05",
      startTime: "10:00"
    }).map((date) => date.toISOString());

    expect(result).toEqual([
      "2026-06-05T07:00:00.000Z",
      "2026-06-08T07:00:00.000Z",
      "2026-06-09T07:00:00.000Z",
      "2026-06-10T07:00:00.000Z"
    ]);
  });

  it("rejects invalid date inputs", () => {
    expect(() => zonedInputToUtc("2026-02-31", "09:30")).toThrow(
      "valid calendar date"
    );
  });
});
