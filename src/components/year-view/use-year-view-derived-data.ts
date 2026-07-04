import { useMemo } from "react";
import { buildEventKey, buildMonthSegments } from "@/domain";
import type { CalendarEvent, CalendarSummary } from "@/domain";

export function useYearViewDerivedData({
  calendars,
  events,
  formatDate,
  isRefreshing,
  selectedCalendarIds,
  year,
}: {
  calendars: CalendarSummary[];
  events: CalendarEvent[];
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  isRefreshing: boolean;
  selectedCalendarIds: string[];
  year: number;
}) {
  const monthNames = useMemo(
    () => [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ],
    [],
  );

  const todayLongLabel = useMemo(() => {
    const today = new Date();
    return formatDate(today, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [formatDate]);

  const syncBadge = useMemo(
    () =>
      isRefreshing
        ? { kind: "syncing" as const, label: "Loading" }
        : { kind: "synced" as const, label: "Local" },
    [isRefreshing],
  );

  const visibleEvents = useMemo(() => {
    const selected = new Set(selectedCalendarIds);
    return events.filter((event) => selected.has(event.calendarId));
  }, [events, selectedCalendarIds]);

  const displayEventMap = useMemo(
    () => new Map(visibleEvents.map((event) => [buildEventKey(event.id, event.calendarId), event])),
    [visibleEvents],
  );

  const unresolvedSelectedCalendarIds = useMemo(() => {
    const knownCalendarIds = new Set(calendars.map((calendar) => calendar.id));
    return selectedCalendarIds.filter((id) => !knownCalendarIds.has(id));
  }, [calendars, selectedCalendarIds]);

  const months = useMemo(() => buildMonthSegments(visibleEvents, year), [visibleEvents, year]);

  return {
    displayEventMap,
    monthNames,
    months,
    syncBadge,
    todayLongLabel,
    unresolvedSelectedCalendarIds,
    visibleEvents,
  };
}
