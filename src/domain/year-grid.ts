import { clampDate, parseEventBoundary, startOfNextYear, startOfYear } from "./date";
import { buildEventKey } from "./event-key";
import type { CalendarEvent, EventSegment, MonthSegments } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

function assignLanes(segments: EventSegment[], month: number): MonthSegments {
  // Only multi-day segments take vertical lanes (columns); single-day events
  // render in the per-day strip instead, so they get the sentinel lane 0.
  // Sort by start day (greedy lane packing); on a tie the longer bar is laid
  // out first so it takes the lower (leftmost) lane.
  const multiDay = segments.filter((segment) => segment.endDay > segment.startDay);
  const singleDay = segments
    .filter((segment) => segment.endDay === segment.startDay)
    .map((segment) => ({ ...segment, lane: 0 }));

  const sorted = [...multiDay].sort((a, b) => a.startDay - b.startDay || b.endDay - a.endDay);

  const laneEnds: number[] = [];
  const assignedSegments: EventSegment[] = [];
  // eslint-disable-next-line functional/no-loop-statements
  for (const segment of sorted) {
    const laneIndex = laneEnds.findIndex((end) => segment.startDay > end);
    if (laneIndex >= 0) {
      // eslint-disable-next-line functional/immutable-data
      laneEnds[laneIndex] = segment.endDay;
      // eslint-disable-next-line functional/immutable-data
      assignedSegments.push({ ...segment, lane: laneIndex + 1 });
    } else {
      // eslint-disable-next-line functional/immutable-data
      laneEnds.push(segment.endDay);
      // eslint-disable-next-line functional/immutable-data
      assignedSegments.push({ ...segment, lane: laneEnds.length });
    }
  }

  // `lanes` is the multi-day lane count (0 when a month has none); the single-day
  // strip column is added on top of this by the renderer.
  return { month, lanes: laneEnds.length, segments: [...assignedSegments, ...singleDay] };
}

export function buildMonthSegments(
  events: readonly CalendarEvent[],
  year: number,
): MonthSegments[] {
  const yearStart = startOfYear(year);
  const yearEnd = startOfNextYear(year);
  const rawByMonth: EventSegment[][] = Array.from({ length: 12 }, () => []);
  // Month boundaries 0..12 (index 12 == start of next year), built once instead
  // of two `new Date` per event-per-month-spanned.
  const monthBoundaries: Date[] = Array.from(
    { length: 13 },
    (_, month) => new Date(year, month, 1, 0, 0, 0, 0),
  );

  // eslint-disable-next-line functional/no-loop-statements
  for (const event of events) {
    const start = parseEventBoundary(event.start, event.allDay);
    const end = parseEventBoundary(event.end, event.allDay);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    if (end <= start) continue;

    const clippedStart = clampDate(start, yearStart, yearEnd);
    const clippedEnd = clampDate(end, yearStart, yearEnd);
    if (clippedEnd <= clippedStart) continue;

    const startMonth = clippedStart.getMonth();
    const endMonth = new Date(clippedEnd.getTime() - 1).getMonth();

    // eslint-disable-next-line functional/no-let, functional/no-loop-statements
    for (let month = startMonth; month <= endMonth; month += 1) {
      const monthStart = monthBoundaries[month]!;
      const monthEnd = monthBoundaries[month + 1]!;
      const segmentStart = clampDate(clippedStart, monthStart, monthEnd);
      const segmentEnd = clampDate(clippedEnd, monthStart, monthEnd);
      if (segmentEnd <= segmentStart) continue;

      const startDay = segmentStart.getDate();
      const endDay = new Date(segmentEnd.getTime() - 1).getDate();

      // eslint-disable-next-line functional/immutable-data
      rawByMonth[month]!.push({
        id: buildEventKey(event.id, event.calendarId),
        title: event.title,
        startDay,
        endDay,
        lane: 1,
        calendarColor: event.calendarColor,
        calendarId: event.calendarId,
        allDay: event.allDay,
        isTimed: event.isTimed,
        isFirstSegment: month === startMonth,
        isLastSegment: month === endMonth,
      });
    }
  }

  return rawByMonth.map((segments, month) => assignLanes(segments, month));
}

export function durationInDays(start: Date, end: Date) {
  return Math.ceil((end.getTime() - start.getTime()) / DAY_MS);
}
