import { useMemo } from "react";
import { formatTimeRange, isWeekend } from "@/components/year-helpers";
import { DAYS_IN_GRID } from "@/components/year-view/constants";
import {
  getTimedEventDayPlacement,
  type TimedEventPlacement,
} from "@/components/year-view/day-timeline-placement";
import { isCalendarEditable } from "@/components/year-view/utils";
import { parseEventBoundary } from "@/domain";
import type { CalendarEvent, CalendarSummary, EventSegment, MonthSegments } from "@/domain";

export type RenderedBar = {
  segment: EventSegment;
  event: CalendarEvent;
  canEdit: boolean;
  fullWidth: boolean;
  displayLane: number;
  renderMode: "full" | "compact" | "micro";
};

export type DaySquare = {
  segment: EventSegment;
  event: CalendarEvent;
  allDay: boolean;
  timedPlacement?: TimedEventPlacement | null;
  timeLabel?: string;
};

export type DayEventItem = {
  key: string;
  event: CalendarEvent;
  allDay: boolean;
};

// Event length in ms, used to order longest → shortest. All-day single events
// (~1 day) naturally sort ahead of timed ones (hours); multi-day spans lead.
export function eventDurationMs(event: CalendarEvent): number {
  const start = parseEventBoundary(event.start, event.allDay);
  const end = parseEventBoundary(event.end, event.allDay);
  const ms = end.getTime() - start.getTime();
  return Number.isFinite(ms) ? ms : 0;
}

export function orderByDurationDesc<T extends { event: CalendarEvent }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      eventDurationMs(b.event) - eventDurationMs(a.event) ||
      a.event.title.localeCompare(b.event.title),
  );
}

export function useRenderedSegments(
  month: MonthSegments,
  events: Map<string, CalendarEvent>,
  calendars: CalendarSummary[],
  year: number,
) {
  const calendarById = useMemo(
    () => new Map(calendars.map((calendar) => [calendar.id, calendar])),
    [calendars],
  );

  return useMemo(() => {
    const resolved = month.segments
      .map((segment) => {
        const event = events.get(segment.id);
        return event ? { segment, event } : null;
      })
      .filter((entry) => entry !== null);

    const multiDayLanes = month.lanes;
    const singles = resolved.filter(({ segment }) => segment.startDay === segment.endDay);
    const hasSingleDay = singles.length > 0;

    const renderMode: RenderedBar["renderMode"] =
      multiDayLanes >= 7 ? "micro" : multiDayLanes >= 5 ? "compact" : "full";

    const bars: RenderedBar[] = resolved
      .filter(({ segment }) => segment.endDay > segment.startDay)
      .map(({ segment, event }) => {
        const calendar = calendarById.get(event.calendarId);
        const canEdit = (calendar ? isCalendarEditable(calendar) : false) && event.allDay;
        return {
          segment,
          event,
          canEdit,
          fullWidth: multiDayLanes <= 1 && !hasSingleDay,
          displayLane: segment.lane,
          renderMode,
        };
      });

    // Single-day events for each day, longest → shortest (all-day before timed).
    const singleDayByDay = singles.reduce((acc, { segment, event }) => {
      const list = acc.get(segment.startDay) ?? [];
      const timedPlacement = event.allDay
        ? null
        : getTimedEventDayPlacement(event, year, month.month, segment.startDay);
      // eslint-disable-next-line functional/immutable-data
      acc.set(segment.startDay, [
        ...list,
        {
          segment,
          event,
          allDay: event.allDay,
          timedPlacement,
          timeLabel: event.allDay ? undefined : formatTimeRange(event),
        },
      ]);
      return acc;
    }, new Map<number, DaySquare[]>());
    const orderedSingleDayByDay = new Map(
      Array.from(singleDayByDay, ([day, list]) => [day, orderByDurationDesc(list)]),
    );

    // Every event touching a day (multi-day bars + single-day), for the hover
    // card. Multi-day events appear on each day they cover.
    const dayEvents = resolved.reduce((acc, { segment, event }) => {
      // eslint-disable-next-line functional/no-let, functional/no-loop-statements
      for (let day = segment.startDay; day <= segment.endDay; day += 1) {
        const list = acc.get(day) ?? [];
        // eslint-disable-next-line functional/immutable-data
        acc.set(day, [...list, { key: segment.id, event, allDay: event.allDay }]);
      }
      return acc;
    }, new Map<number, DayEventItem[]>());
    const orderedDayEvents = new Map(
      Array.from(dayEvents, ([day, list]) => [day, orderByDurationDesc(list)]),
    );

    return {
      bars,
      singleDayByDay: orderedSingleDayByDay,
      dayEvents: orderedDayEvents,
      multiDayLanes,
    };
  }, [month.segments, month.lanes, month.month, events, calendarById, year]);
}

/** Ordered events for one day — used by keyboard day panel. */
export function getOrderedDayEvents(
  month: MonthSegments,
  events: Map<string, CalendarEvent>,
  day: number,
): DayEventItem[] {
  const items = month.segments.flatMap((segment) => {
    if (day < segment.startDay || day > segment.endDay) return [];
    const event = events.get(segment.id);
    return event ? [{ key: segment.id, event, allDay: event.allDay }] : [];
  });
  return orderByDurationDesc(items);
}

export function useWeekendRows(year: number, month: number, daysInMonth: number) {
  return useMemo(() => {
    return Array.from({ length: DAYS_IN_GRID }, (_, index) => {
      const day = index + 1;
      if (day > daysInMonth) return false;
      return isWeekend(year, month, day);
    });
  }, [year, month, daysInMonth]);
}
