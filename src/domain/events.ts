import { isTimedMultiDayEvent, parseEventBoundary, serializeEventBoundary } from "./date";
import type { CalendarEvent, CalendarSummary } from "./types";

export function normalizeEvent(
  event: {
    id?: string | null;
    summary?: string | null;
    description?: string | null;
    start?: { date?: string | null; dateTime?: string | null } | null;
    end?: { date?: string | null; dateTime?: string | null } | null;
    htmlLink?: string | null;
    etag?: string | null;
    recurringEventId?: string | null;
  },
  calendar: CalendarSummary,
): CalendarEvent | null {
  const startValue = event.start?.dateTime ?? event.start?.date;
  const endValue = event.end?.dateTime ?? event.end?.date;
  if (!startValue || !endValue) return null;

  const isAllDay = Boolean(event.start?.date);
  const startDate = parseEventBoundary(startValue, isAllDay);
  const endDate = parseEventBoundary(endValue, isAllDay);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  const durationMs = endDate.getTime() - startDate.getTime();
  if (durationMs <= 0) return null;
  if (!isAllDay && !isTimedMultiDayEvent(startDate, endDate)) return null;

  return {
    id: event.id ?? crypto.randomUUID(),
    title: event.summary ?? "Untitled",
    description: event.description ?? null,
    start: serializeEventBoundary(startDate, isAllDay),
    end: serializeEventBoundary(endDate, isAllDay),
    allDay: isAllDay,
    isTimed: !isAllDay,
    calendarId: calendar.id,
    calendarColor: calendar.backgroundColor ?? null,
    calendarSummary: calendar.summary ?? null,
    htmlLink: event.htmlLink ?? null,
    etag: event.etag ?? null,
    recurringEventId: event.recurringEventId ?? null,
    syncState: "synced",
    lastSyncedAt: new Date().toISOString(),
    pendingMutationIds: [],
  };
}
