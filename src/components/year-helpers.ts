import type { CalendarEvent } from "@/domain";
import { addDays, parseEventBoundary } from "@/domain";
import { ONE_DAY_MS } from "@/components/year-view/constants";

export const ROW_HEIGHT = 30;

// Constructing an Intl.DateTimeFormat does locale negotiation + pattern
// compilation, so these are built once and reused across every event render.
const DATE_RANGE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const TIME_RANGE_FORMAT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

/** Full-span length of the event in calendar days (matches all-day exclusive-end semantics and drag preview). */
export function eventCalendarSpanDays(event: CalendarEvent) {
  const start = parseEventBoundary(event.start, event.allDay);
  const end = parseEventBoundary(event.end, event.allDay);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / ONE_DAY_MS));
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDateRange(event: CalendarEvent) {
  const start = parseEventBoundary(event.start, event.allDay);
  const end = parseEventBoundary(event.end, event.allDay);
  const displayEnd = event.allDay ? addDays(end, -1) : end;
  if (isSameDay(start, displayEnd)) {
    return DATE_RANGE_FORMAT.format(start);
  }
  return `${DATE_RANGE_FORMAT.format(start)} – ${DATE_RANGE_FORMAT.format(displayEnd)}`;
}

export function formatTimeRange(event: CalendarEvent) {
  if (event.allDay) {
    return "All day";
  }

  const start = parseEventBoundary(event.start, event.allDay);
  const end = parseEventBoundary(event.end, event.allDay);

  return `${TIME_RANGE_FORMAT.format(start)} – ${TIME_RANGE_FORMAT.format(end)}`;
}

export function isWeekend(year: number, month: number, day: number) {
  const date = new Date(year, month, day);
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}
