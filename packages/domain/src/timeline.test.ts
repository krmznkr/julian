import { describe, expect, it } from "vitest";
import {
  buildTimelineRows,
  dateFromDayIndex,
  dayIndexInYear,
  daysInYear,
  shiftTimelineWindow,
  timelineWindowStart,
  timelineZoomDays,
} from "./index";
import type { CalendarEvent } from "./index";

function event(overrides: Partial<CalendarEvent> & { start: string; end: string }): CalendarEvent {
  return {
    id: "e1",
    title: "Event",
    calendarId: "cal-1",
    allDay: true,
    isTimed: false,
    ...overrides,
  };
}

function ymd(date: Date) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
}

describe("day indexes", () => {
  it("counts leap and common years", () => {
    expect(daysInYear(2026)).toBe(365);
    expect(daysInYear(2028)).toBe(366);
  });

  it("maps dates to 0-based indexes and back across DST changes", () => {
    expect(dayIndexInYear(new Date(2026, 0, 1), 2026)).toBe(0);
    expect(dayIndexInYear(new Date(2026, 2, 30, 23, 59), 2026)).toBe(88);
    expect(dayIndexInYear(new Date(2026, 11, 31), 2026)).toBe(364);
    expect(dayIndexInYear(new Date(2025, 11, 31), 2026)).toBe(-1);
    expect(ymd(dateFromDayIndex(2026, 88))).toEqual([2026, 3, 30]);
    expect(ymd(dateFromDayIndex(2026, 305))).toEqual([2026, 11, 2]);
  });
});

describe("buildTimelineRows", () => {
  it("keeps an empty row for a calendar with no events and drops unknown calendars", () => {
    const rows = buildTimelineRows(
      [event({ calendarId: "other", start: "2026-01-02", end: "2026-01-03" })],
      ["cal-1"],
      2026,
    );
    expect(rows).toEqual([{ calendarId: "cal-1", lanes: 1, bars: [] }]);
  });

  it("uses inclusive day indexes from exclusive all-day ends", () => {
    const [row] = buildTimelineRows(
      [event({ start: "2026-03-05", end: "2026-03-10" })],
      ["cal-1"],
      2026,
    );
    expect(row?.bars[0]).toMatchObject({
      key: "cal-1::e1",
      startIndex: 63,
      endIndex: 67,
      lane: 0,
      continuesBefore: false,
      continuesAfter: false,
    });
  });

  it("packs overlapping bars into lanes and reuses freed lanes", () => {
    const [row] = buildTimelineRows(
      [
        event({ id: "long", start: "2026-01-01", end: "2026-01-11" }),
        event({ id: "overlap", start: "2026-01-05", end: "2026-01-06" }),
        event({ id: "after", start: "2026-01-11", end: "2026-01-12" }),
        event({ id: "later", start: "2026-01-06", end: "2026-01-08" }),
      ],
      ["cal-1"],
      2026,
    );
    expect(row?.lanes).toBe(2);
    expect(row?.bars.map((bar) => [bar.event.id, bar.lane])).toEqual([
      ["long", 0],
      ["overlap", 1],
      ["later", 1],
      ["after", 0],
    ]);
  });

  it("lets a short bar reserve room for its label", () => {
    const [row] = buildTimelineRows(
      [
        event({ id: "a", title: "A long title", start: "2026-01-01", end: "2026-01-02" }),
        event({ id: "b", start: "2026-01-03", end: "2026-01-04" }),
        event({ id: "c", start: "2026-01-06", end: "2026-01-07" }),
      ],
      ["cal-1"],
      2026,
      (item) => (item.id === "a" ? 5 : 0),
    );
    expect(row?.bars.map((bar) => [bar.event.id, bar.lane])).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 0],
    ]);
  });

  it("clips events that cross the year edges", () => {
    const [row] = buildTimelineRows(
      [
        event({ id: "into", start: "2025-12-28", end: "2026-01-03" }),
        event({ id: "out", start: "2026-12-30", end: "2027-01-04" }),
        event({ id: "before", start: "2025-06-01", end: "2025-06-02" }),
        event({ id: "after", start: "2027-01-01", end: "2027-01-02" }),
      ],
      ["cal-1"],
      2026,
    );
    expect(row?.bars).toHaveLength(2);
    expect(row?.bars[0]).toMatchObject({ startIndex: 0, endIndex: 1, continuesBefore: true });
    expect(row?.bars[1]).toMatchObject({ startIndex: 363, endIndex: 364, continuesAfter: true });
  });

  it("keeps a short overnight timed event on its start day", () => {
    const start = new Date(2026, 4, 10, 23, 30);
    const end = new Date(2026, 4, 11, 0, 15);
    const [row] = buildTimelineRows(
      [
        event({
          allDay: false,
          isTimed: true,
          start: start.toISOString(),
          end: end.toISOString(),
        }),
      ],
      ["cal-1"],
      2026,
    );
    expect(row?.bars[0]).toMatchObject({ startIndex: 129, endIndex: 129 });
  });

  it("skips events with invalid dates", () => {
    const [row] = buildTimelineRows(
      [event({ start: "2026-02-10", end: "2026-02-10" })],
      ["cal-1"],
      2026,
    );
    expect(row?.bars).toEqual([]);
  });
});

describe("timeline windows", () => {
  it("knows how many days each zoom shows", () => {
    expect(timelineZoomDays("week", 2026)).toBe(7);
    expect(timelineZoomDays("month", 2026)).toBe(31);
    expect(timelineZoomDays("quarter", 2026)).toBe(92);
    expect(timelineZoomDays("year", 2028)).toBe(366);
  });

  it("snaps a date to the start of its window", () => {
    const date = new Date(2026, 10, 6, 15, 0);
    expect(ymd(timelineWindowStart("week", date))).toEqual([2026, 11, 2]);
    expect(ymd(timelineWindowStart("week", new Date(2026, 10, 8)))).toEqual([2026, 11, 2]);
    expect(ymd(timelineWindowStart("month", date))).toEqual([2026, 11, 1]);
    expect(ymd(timelineWindowStart("quarter", date))).toEqual([2026, 10, 1]);
    expect(ymd(timelineWindowStart("year", date))).toEqual([2026, 1, 1]);
  });

  it("steps whole windows forward and back, across years", () => {
    const date = new Date(2026, 11, 30);
    expect(ymd(shiftTimelineWindow("week", date, 1))).toEqual([2027, 1, 4]);
    expect(ymd(shiftTimelineWindow("month", date, 1))).toEqual([2027, 1, 1]);
    expect(ymd(shiftTimelineWindow("quarter", new Date(2026, 1, 3), -1))).toEqual([2025, 10, 1]);
    expect(ymd(shiftTimelineWindow("year", date, -1))).toEqual([2025, 1, 1]);
  });
});
