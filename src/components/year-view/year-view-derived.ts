import { buildEventKey } from "@/domain";
import type { CalendarEvent, CalendarSummary } from "@/domain";

export function buildMonthNames(
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  return [
    t("calendar.months.january"),
    t("calendar.months.february"),
    t("calendar.months.march"),
    t("calendar.months.april"),
    t("calendar.months.may"),
    t("calendar.months.june"),
    t("calendar.months.july"),
    t("calendar.months.august"),
    t("calendar.months.september"),
    t("calendar.months.october"),
    t("calendar.months.november"),
    t("calendar.months.december"),
  ];
}

export function buildSourceEventMap(events: CalendarEvent[]) {
  return new Map(events.map((event) => [buildEventKey(event.id, event.calendarId), event]));
}

export function buildDisplayEvents(
  events: CalendarEvent[],
  eventRangePreviews: Record<string, { start: string; endExclusive: string }>,
) {
  return events.map((event) => {
    const key = buildEventKey(event.id, event.calendarId);
    const preview = eventRangePreviews[key];
    if (!preview) return event;
    return {
      ...event,
      start: preview.start,
      end: preview.endExclusive,
    };
  });
}

export function buildDisplayEventMap(events: CalendarEvent[]) {
  return new Map(events.map((event) => [buildEventKey(event.id, event.calendarId), event]));
}

export function getUnresolvedSelectedCalendarIds(
  calendars: CalendarSummary[],
  selectedCalendarIds: string[],
) {
  const knownCalendarIds = new Set(calendars.map((calendar) => calendar.id));
  return selectedCalendarIds.filter((id) => !knownCalendarIds.has(id));
}

export function getDefaultCalendarId(calendars: CalendarSummary[], selectedCalendarIds: string[]) {
  return (
    calendars.find((calendar) => selectedCalendarIds.includes(calendar.id))?.id ??
    calendars[0]?.id ??
    ""
  );
}
