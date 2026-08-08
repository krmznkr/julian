import type { CalendarSummary } from "./types";

/**
 * Google Tasks has no calendar of its own, so the year view synthesises one to
 * show tasks alongside events. It is read-only: tasks are not events and the
 * Calendar API cannot write to it.
 */
export const TASKS_CALENDAR_ID = "__google_tasks__";
export const TASKS_CALENDAR_COLOR = "#8b5cf6";

const WRITABLE_ROLES = new Set(["owner", "writer"]);

/**
 * Whether we may create or modify events on this calendar.
 *
 * A missing `accessRole` is treated as writable: the field is optional on the
 * Calendar API's response, and locally constructed calendars (the landing-page
 * fixtures) omit it. The synthetic tasks calendar is always read-only.
 */
export function isWritableCalendar(
  calendar: Pick<CalendarSummary, "id" | "accessRole"> | undefined | null,
): boolean {
  if (!calendar) return false;
  if (calendar.id === TASKS_CALENDAR_ID) return false;
  return calendar.accessRole == null || WRITABLE_ROLES.has(calendar.accessRole);
}

/** Where a quick-added event should land: the primary calendar, else any writable one. */
export function getDefaultWritableCalendar(
  calendars: ReadonlyArray<CalendarSummary>,
): CalendarSummary | null {
  const primary = calendars.find((calendar) => calendar.primary && isWritableCalendar(calendar));
  if (primary) return primary;
  return calendars.find((calendar) => isWritableCalendar(calendar)) ?? null;
}
