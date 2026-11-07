// Layout for the timeline view: one row per calendar, the year as a horizontal
// axis of days, and each event as a bar packed into the lowest free lane.
import { clampDate, getEventBounds, startOfNextYear, startOfYear } from "./date";
import { buildEventKey } from "./event-key";
import type { CalendarEvent } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type TimelineBar = {
  /** `buildEventKey(event.id, event.calendarId)`. */
  readonly key: string;
  readonly event: CalendarEvent;
  /** First occupied day, as a 0-based index into the year. */
  readonly startIndex: number;
  /** Last occupied day (inclusive), as a 0-based index into the year. */
  readonly endIndex: number;
  /** 0-based lane within the calendar's row. */
  readonly lane: number;
  /** The event starts before this year. */
  readonly continuesBefore: boolean;
  /** The event ends after this year. */
  readonly continuesAfter: boolean;
};

export type TimelineRow = {
  readonly calendarId: string;
  /** Number of lanes the row needs; at least 1 so empty calendars keep a row. */
  readonly lanes: number;
  /** Bars ordered by start day, then lane. */
  readonly bars: ReadonlyArray<TimelineBar>;
};

/** Local calendar date as a day number, immune to DST-length days. */
function localDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

export function daysInYear(year: number): number {
  return localDayNumber(startOfNextYear(year)) - localDayNumber(startOfYear(year));
}

/** 0-based index of `date`'s local calendar day within `year`; may fall outside 0..365. */
export function dayIndexInYear(date: Date, year: number): number {
  return localDayNumber(date) - localDayNumber(startOfYear(year));
}

/** Local midnight of the `index`-th day of `year` (0 is January 1). */
export function dateFromDayIndex(year: number, index: number): Date {
  return new Date(year, 0, 1 + index, 0, 0, 0, 0);
}

type UnplacedBar = Omit<TimelineBar, "lane">;

/**
 * Whether an event belongs on the timeline, which draws spans: all-day events
 * and timed events that run across days. A meeting within one day (or a short
 * one past midnight) does not.
 */
export function isTimelineEvent(event: CalendarEvent): boolean {
  if (event.allDay) return true;
  const bounds = getEventBounds(event);
  return (
    bounds !== null &&
    bounds.spanDays > 1 &&
    bounds.end.getTime() - bounds.start.getTime() >= DAY_MS
  );
}

function toBar(event: CalendarEvent, year: number): UnplacedBar | null {
  const bounds = getEventBounds(event);
  if (!bounds) return null;
  const { start, lastOccupiedDate: lastDay } = bounds;

  const yearStart = startOfYear(year);
  const yearEnd = startOfNextYear(year);
  const clippedStart = clampDate(start, yearStart, yearEnd);
  const clippedLast = clampDate(lastDay, yearStart, new Date(yearEnd.getTime() - 1));
  if (lastDay < yearStart || start >= yearEnd) return null;

  return {
    key: buildEventKey(event.id, event.calendarId),
    event,
    startIndex: dayIndexInYear(clippedStart, year),
    endIndex: dayIndexInYear(clippedLast, year),
    continuesBefore: start < yearStart,
    continuesAfter: lastDay >= yearEnd,
  };
}

/**
 * Greedy interval packing: earliest start first, longer bar first on a tie.
 * `reserveDays` lets a short bar claim extra room for a label drawn beside it.
 */
function packLanes(
  bars: ReadonlyArray<UnplacedBar>,
  reserveDays: (bar: UnplacedBar) => number,
): {
  lanes: number;
  bars: ReadonlyArray<TimelineBar>;
} {
  const sorted = [...bars].sort(
    (a, b) => a.startIndex - b.startIndex || b.endIndex - a.endIndex || a.key.localeCompare(b.key),
  );
  const packed = sorted.reduce<{
    laneEnds: ReadonlyArray<number>;
    bars: ReadonlyArray<TimelineBar>;
  }>(
    (acc, bar) => {
      const free = acc.laneEnds.findIndex((end) => bar.startIndex > end);
      const lane = free >= 0 ? free : acc.laneEnds.length;
      const occupiedEnd = Math.max(bar.endIndex, bar.startIndex + reserveDays(bar) - 1);
      const laneEnds =
        free >= 0
          ? acc.laneEnds.map((end, index) => (index === lane ? occupiedEnd : end))
          : [...acc.laneEnds, occupiedEnd];
      return { laneEnds, bars: [...acc.bars, { ...bar, lane }] };
    },
    { laneEnds: [], bars: [] },
  );
  return { lanes: Math.max(1, packed.laneEnds.length), bars: packed.bars };
}

/**
 * One row per calendar, in the order given. Events whose calendar is not in
 * `calendarIds`, and timed events within a day (`isTimelineEvent`), are
 * dropped; calendars without events still get an empty row.
 * `reserveDays` is how many days an event should block in its lane, when that
 * is more than it lasts (room for a title drawn past a short bar).
 */
export function buildTimelineRows(
  events: ReadonlyArray<CalendarEvent>,
  calendarIds: ReadonlyArray<string>,
  year: number,
  reserveDays: (event: CalendarEvent) => number = () => 0,
): TimelineRow[] {
  return calendarIds.map((calendarId) => ({
    calendarId,
    ...packLanes(
      events
        .filter((event) => event.calendarId === calendarId && isTimelineEvent(event))
        .map((event) => toBar(event, year))
        .filter((bar): bar is UnplacedBar => bar !== null),
      (bar) => reserveDays(bar.event),
    ),
  }));
}

/** How much of the year the timeline shows at once. */
export type TimelineZoom = "week" | "month" | "quarter" | "year";

export const TIMELINE_ZOOMS: ReadonlyArray<TimelineZoom> = ["week", "month", "quarter", "year"];

/** Days that fill the visible track at each zoom; months and quarters use their longest length. */
export function timelineZoomDays(zoom: TimelineZoom, year: number): number {
  switch (zoom) {
    case "week":
      return 7;
    case "month":
      return 31;
    case "quarter":
      return 92;
    case "year":
      return daysInYear(year);
  }
}

/** Local midnight that starts the zoom's window containing `date` (weeks start on Monday). */
export function timelineWindowStart(zoom: TimelineZoom, date: Date): Date {
  const y = date.getFullYear();
  const m = date.getMonth();
  switch (zoom) {
    case "week":
      return new Date(y, m, date.getDate() - ((date.getDay() + 6) % 7));
    case "month":
      return new Date(y, m, 1);
    case "quarter":
      return new Date(y, m - (m % 3), 1);
    case "year":
      return new Date(y, 0, 1);
  }
}

/** Start of the window `direction` steps away from the one containing `date`. */
export function shiftTimelineWindow(zoom: TimelineZoom, date: Date, direction: number): Date {
  const start = timelineWindowStart(zoom, date);
  const y = start.getFullYear();
  const m = start.getMonth();
  switch (zoom) {
    case "week":
      return new Date(y, m, start.getDate() + 7 * direction);
    case "month":
      return new Date(y, m + direction, 1);
    case "quarter":
      return new Date(y, m + 3 * direction, 1);
    case "year":
      return new Date(y + direction, 0, 1);
  }
}
