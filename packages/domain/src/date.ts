import type { CalendarEvent } from "./types";

export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnlyString(value: string) {
  return DATE_ONLY_PATTERN.test(value);
}

export function parseDateInput(value: string) {
  if (!isDateOnlyString(value)) return new Date(NaN);
  const date = new Date(`${value}T00:00:00`);
  return toDateInputValue(date) === value ? date : new Date(NaN);
}

export function parseEventBoundary(value: string, allDay: boolean) {
  if (!allDay) {
    return new Date(value);
  }
  if (isDateOnlyString(value)) {
    return parseDateInput(value);
  }
  // Legacy all-day timestamps still represent calendar dates, not instants.
  if (!Number.isFinite(Date.parse(value))) return new Date(NaN);
  return parseDateInput(value.slice(0, 10));
}

export function serializeEventBoundary(date: Date, allDay: boolean) {
  return allDay ? toDateInputValue(date) : date.toISOString();
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function clampDate(date: Date, min: Date, max: Date) {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function isTimedMultiDayEvent(startDate: Date, endDate: Date): boolean {
  return (
    endDate > startDate &&
    startOfDay(new Date(endDate.getTime() - 1)).getTime() > startOfDay(startDate).getTime()
  );
}

// Google end boundaries are exclusive for both all-day and timed events.
export function getEventBounds(event: Pick<CalendarEvent, "start" | "end" | "allDay">) {
  const start = parseEventBoundary(event.start, event.allDay);
  const end = parseEventBoundary(event.end, event.allDay);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
    return null;
  const lastOccupiedDate = new Date(end.getTime() - 1);
  const dayNumber = (date: Date) =>
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000;
  const spanDays = dayNumber(lastOccupiedDate) - dayNumber(start) + 1;
  return { start, end, lastOccupiedDate, spanDays };
}

export function startOfYear(year: number) {
  return new Date(year, 0, 1, 0, 0, 0, 0);
}

export function startOfNextYear(year: number) {
  return new Date(year + 1, 0, 1, 0, 0, 0, 0);
}

/** Move an all-day span without turning DST transitions into shorter days. */
export function moveAllDayDates(
  event: Pick<CalendarEvent, "start" | "end">,
  date: string,
): { start: string; end: string } {
  const toUtc = (value: string) => Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
  const days = Math.max(1, Math.round((toUtc(event.end) - toUtc(event.start)) / 86_400_000));
  return { start: date, end: new Date(toUtc(date) + days * 86_400_000).toISOString().slice(0, 10) };
}

/** Keyboard movement within one displayed year; month changes clamp the day. */
export function navigateYearDate(value: string, key: string): string {
  const date = parseDateInput(value);
  if (!Number.isFinite(date.getTime())) return value;
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const targetMonth = month + (key === "ArrowRight" ? 1 : -1);
  const target =
    key === "ArrowLeft" || key === "ArrowRight"
      ? new Date(year, targetMonth, Math.min(day, new Date(year, targetMonth + 1, 0).getDate()))
      : key === "ArrowUp" || key === "ArrowDown"
        ? addDays(date, key === "ArrowUp" ? -1 : 1)
        : key === "Home"
          ? new Date(year, month, 1)
          : key === "End"
            ? new Date(year, month + 1, 0)
            : date;
  return toDateInputValue(clampDate(target, startOfYear(year), new Date(year, 11, 31)));
}

// UTC date serialization for API payloads and Google Tasks due dates.
// Displayed all-day dates use parseEventBoundary instead.
export function toUtcDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
