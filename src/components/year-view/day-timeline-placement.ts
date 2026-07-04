import { ONE_DAY_MS } from "@/components/year-view/constants";
import { parseEventBoundary } from "@/domain";
import type { CalendarEvent } from "@/domain";

export type TimedEventDayRange = {
  startPct: number;
  endPct: number;
};

/** @deprecated Use TimedEventDayRange — kept for existing horizontal-axis callers. */
export type TimedEventPlacement = {
  leftPct: number;
  widthPct: number;
};

export type TimedEventLaneLayout = TimedEventDayRange & {
  key: string;
  lane: number;
  laneCount: number;
};

/** Map a timed event onto the 0–24h axis for a specific calendar day. */
export function getTimedEventDayRange(
  event: CalendarEvent,
  year: number,
  month: number,
  day: number,
): TimedEventDayRange | null {
  if (event.allDay) {
    return null;
  }

  const dayStartMs = new Date(year, month, day, 0, 0, 0, 0).getTime();
  const dayEndMs = dayStartMs + ONE_DAY_MS;

  const startMs = parseEventBoundary(event.start, false).getTime();
  const endMs = parseEventBoundary(event.end, false).getTime();

  const clampedStart = Math.max(startMs, dayStartMs);
  const clampedEnd = Math.min(endMs, dayEndMs);

  if (clampedEnd <= clampedStart) {
    return null;
  }

  return {
    startPct: ((clampedStart - dayStartMs) / ONE_DAY_MS) * 100,
    endPct: ((clampedEnd - dayStartMs) / ONE_DAY_MS) * 100,
  };
}

export function getTimedEventDayPlacement(
  event: CalendarEvent,
  year: number,
  month: number,
  day: number,
): TimedEventPlacement | null {
  const range = getTimedEventDayRange(event, year, month, day);
  if (!range) {
    return null;
  }

  return {
    leftPct: range.startPct,
    widthPct: range.endPct - range.startPct,
  };
}

/** True when a timed event covers essentially the full calendar day on this axis. */
export function isFullDayTimedPlacement(
  placement: TimedEventPlacement | null | undefined,
): boolean {
  if (!placement) return false;
  return placement.leftPct <= 0.1 && placement.widthPct >= 99.8;
}

/** Greedy lane assignment for overlapping timed events (side-by-side columns). */
export function assignTimedEventLanes(
  ranges: Array<{ key: string; range: TimedEventDayRange }>,
): Map<string, { lane: number; laneCount: number }> {
  const sorted = [...ranges].sort(
    (a, b) => a.range.startPct - b.range.startPct || a.range.endPct - b.range.endPct,
  );

  // eslint-disable-next-line functional/no-let
  let laneEnds: number[] = [];
  const lanes = new Map<string, number>();

  // eslint-disable-next-line functional/no-loop-statements
  for (const { key, range } of sorted) {
    const lane = laneEnds.findIndex((end) => range.startPct >= end);
    const resolvedLane = lane === -1 ? laneEnds.length : lane;

    if (lane === -1) {
      // eslint-disable-next-line functional/immutable-data
      laneEnds = [...laneEnds, range.endPct];
    } else {
      laneEnds = laneEnds.map((end, i) => (i === lane ? range.endPct : end));
    }

    // eslint-disable-next-line functional/immutable-data
    lanes.set(key, resolvedLane);
  }

  const laneCount = Math.max(1, laneEnds.length);
  return new Map(Array.from(lanes, ([key, lane]) => [key, { lane, laneCount }]));
}

export function layoutTimedEventsForDay(
  events: Array<{ key: string; event: CalendarEvent }>,
  year: number,
  month: number,
  day: number,
): TimedEventLaneLayout[] {
  const ranges = events.flatMap(({ key, event }) => {
    const range = getTimedEventDayRange(event, year, month, day);
    return range ? [{ key, range }] : [];
  });

  const lanes = assignTimedEventLanes(ranges);

  return ranges.map(({ key, range }) => {
    const { lane, laneCount } = lanes.get(key) ?? { lane: 0, laneCount: 1 };
    return { key, ...range, lane, laneCount };
  });
}
