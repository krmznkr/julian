import { useMemo, useState } from "react";
import { buildEventKey, buildMonthSegments } from "@julian/domain";
import { matchesEventQuery } from "@/components/year-view/event-search";
import type { YearSourceFailure } from "@/components/year-view/year-view-ports";
import type { CalendarEvent, CalendarSummary } from "@julian/domain";

export function useYearViewDerivedData({
  calendars,
  events,
  failures,
  formatDate,
  isRefreshing,
  searchQuery,
  selectedCalendarIds,
  year,
}: {
  calendars: ReadonlyArray<CalendarSummary>;
  events: ReadonlyArray<CalendarEvent>;
  failures: ReadonlyArray<YearSourceFailure>;
  formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => string;
  isRefreshing: boolean;
  searchQuery: string;
  selectedCalendarIds: ReadonlyArray<string>;
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

  const [today] = useState(() => new Date());
  const todayLongLabel = useMemo(() => {
    return formatDate(today, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }, [formatDate, today]);

  // A partial failure is the interesting case: the year rendered, but some of
  // it is missing. Without this the visitor sees a normal, complete-looking
  // calendar and has no way to tell that a source dropped out.
  const syncBadge = useMemo(() => {
    if (isRefreshing) return { kind: "syncing" as const, label: "Loading" };
    if (failures.length > 0) {
      return {
        kind: "issues" as const,
        label:
          failures.length === 1
            ? `Could not load ${failures[0]?.source ?? "one calendar"}`
            : `Could not load ${failures.length} calendars`,
      };
    }
    return { kind: "synced" as const, label: "Local" };
  }, [failures, isRefreshing]);

  const visibleEvents = useMemo(() => {
    const selected = new Set(selectedCalendarIds);
    return events.filter(
      (event) => selected.has(event.calendarId) && matchesEventQuery(event, searchQuery),
    );
  }, [events, searchQuery, selectedCalendarIds]);

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
