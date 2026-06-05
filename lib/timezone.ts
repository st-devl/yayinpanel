import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

export const DEFAULT_TIMEZONE = "Europe/Istanbul";
export const PANEL_DATE_FORMAT = "dd.MM.yyyy";
export const PANEL_TIME_FORMAT = "HH:mm";
export const PANEL_DATE_TIME_FORMAT = `${PANEL_DATE_FORMAT} ${PANEL_TIME_FORMAT}`;

export const scheduleFrequencies = [
  "daily",
  "every_two_days",
  "weekly"
] as const;

export type ScheduleFrequency = (typeof scheduleFrequencies)[number];

export type BuildBulkScheduleInput = {
  startDate: string;
  startTime: string;
  count: number;
  frequency: ScheduleFrequency;
  skipWeekends?: boolean;
  timezone?: string;
};

const frequencyDayIntervals: Record<ScheduleFrequency, number> = {
  daily: 1,
  every_two_days: 2,
  weekly: 7
};

function assertDateInput(date: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!match) {
    throw new Error("Date input must use YYYY-MM-DD format");
  }

  const [, yearValue, monthValue, dayValue] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error("Date input is not a valid calendar date");
  }
}

function assertTimeInput(time: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new Error("Time input must use HH:mm 24-hour format");
  }
}

function assertTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
}

function addDaysToDateInput(date: string, days: number) {
  assertDateInput(date);

  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));

  return formatInTimeZone(next, "UTC", "yyyy-MM-dd");
}

function getDateInputWeekday(date: string) {
  assertDateInput(date);

  const [year, month, day] = date.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function isWeekendDateInput(date: string) {
  const day = getDateInputWeekday(date);

  return day === 0 || day === 6;
}

function nextWeekdayDateInput(date: string) {
  let candidate = date;

  while (isWeekendDateInput(candidate)) {
    candidate = addDaysToDateInput(candidate, 1);
  }

  return candidate;
}

export function zonedInputToUtc(
  date: string,
  time: string,
  timezone = DEFAULT_TIMEZONE
) {
  assertDateInput(date);
  assertTimeInput(time);
  assertTimezone(timezone);

  return fromZonedTime(`${date}T${time}:00`, timezone);
}

export function zonedDateTimeInputToUtc(
  value: string,
  timezone = DEFAULT_TIMEZONE
) {
  const [date, time] = value.split("T");

  if (!date || !time) {
    throw new Error("Date time input must use YYYY-MM-DDTHH:mm format");
  }

  return zonedInputToUtc(date, time, timezone);
}

export function utcToZonedDate(date: Date, timezone = DEFAULT_TIMEZONE) {
  assertTimezone(timezone);

  return toZonedTime(date, timezone);
}

export function formatPanelDateTime(date: Date, timezone = DEFAULT_TIMEZONE) {
  assertTimezone(timezone);

  return formatInTimeZone(date, timezone, PANEL_DATE_TIME_FORMAT);
}

export function formatPanelDate(date: Date, timezone = DEFAULT_TIMEZONE) {
  assertTimezone(timezone);

  return formatInTimeZone(date, timezone, PANEL_DATE_FORMAT);
}

export function formatPanelTime(date: Date, timezone = DEFAULT_TIMEZONE) {
  assertTimezone(timezone);

  return formatInTimeZone(date, timezone, PANEL_TIME_FORMAT);
}

export function utcToZonedDateTimeInput(
  date: Date,
  timezone = DEFAULT_TIMEZONE
) {
  assertTimezone(timezone);

  return formatInTimeZone(date, timezone, "yyyy-MM-dd'T'HH:mm");
}

export function buildBulkSchedule(input: BuildBulkScheduleInput) {
  const timezone = input.timezone ?? DEFAULT_TIMEZONE;
  const interval = frequencyDayIntervals[input.frequency];

  assertDateInput(input.startDate);
  assertTimeInput(input.startTime);
  assertTimezone(timezone);

  if (!Number.isInteger(input.count) || input.count < 1 || input.count > 500) {
    throw new Error("Schedule count must be an integer between 1 and 500");
  }

  let cursor = input.startDate;
  const scheduledAt: Date[] = [];

  while (scheduledAt.length < input.count) {
    const candidate = input.skipWeekends
      ? nextWeekdayDateInput(cursor)
      : cursor;

    scheduledAt.push(zonedInputToUtc(candidate, input.startTime, timezone));
    cursor = addDaysToDateInput(candidate, interval);
  }

  return scheduledAt;
}
