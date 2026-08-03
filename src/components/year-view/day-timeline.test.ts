import { describe, expect, it } from "vitest";
import {
  assignTimedEventLanes,
  getTimedEventDayPlacement,
  getTimedEventDayRange,
  isFullDayTimedPlacement,
} from "@/components/year-view/day-timeline-placement";
import { hourToDayPct } from "@/components/year-view/constants";
import type { CalendarEvent } from "@/domain";

function timedEvent(start: string, end: string): CalendarEvent {
  return {
    id: "evt",
    calendarId: "cal",
    title: "Meeting",
    start,
    end,
    allDay: false,
    isTimed: true,
  };
}

describe("getTimedEventDayRange", () => {
  it("maps a one-hour block to proportional range", () => {
    const range = getTimedEventDayRange(
      timedEvent("2026-03-05T09:00:00", "2026-03-05T10:00:00"),
      2026,
      2,
      5,
    );

    expect(range?.startPct).toBe(37.5);
    expect(range?.endPct).toBeCloseTo(41.667, 2);
  });

  it("clips events that spill past midnight", () => {
    const range = getTimedEventDayRange(
      timedEvent("2026-03-05T22:00:00", "2026-03-06T02:00:00"),
      2026,
      2,
      5,
    );

    expect(range?.startPct).toBeCloseTo(91.666, 2);
    expect(range?.endPct).toBe(100);
  });

  it("returns null for all-day events", () => {
    expect(
      getTimedEventDayRange(
        { ...timedEvent("2026-03-05", "2026-03-06"), allDay: true },
        2026,
        2,
        5,
      ),
    ).toBeNull();
  });
});

describe("getTimedEventDayPlacement", () => {
  it("maps range to left/width for horizontal callers", () => {
    const placement = getTimedEventDayPlacement(
      timedEvent("2026-03-05T09:00:00", "2026-03-05T10:00:00"),
      2026,
      2,
      5,
    );

    expect(placement?.leftPct).toBe(37.5);
    expect(placement?.widthPct).toBeCloseTo(4.167, 2);
  });
});

describe("hourToDayPct", () => {
  it("maps key day hours to timeline positions", () => {
    expect(hourToDayPct(8)).toBeCloseTo(33.333, 2);
    expect(hourToDayPct(12)).toBe(50);
    expect(hourToDayPct(18)).toBe(75);
    expect(hourToDayPct(21)).toBe(87.5);
  });
});

describe("isFullDayTimedPlacement", () => {
  it("returns true when placement spans the full day", () => {
    expect(isFullDayTimedPlacement({ leftPct: 0, widthPct: 100 })).toBe(true);
  });

  it("returns false for partial-day placement", () => {
    expect(isFullDayTimedPlacement({ leftPct: 37.5, widthPct: 4.167 })).toBe(false);
  });
});

describe("assignTimedEventLanes", () => {
  it("places non-overlapping events in one lane", () => {
    const lanes = assignTimedEventLanes([
      { key: "a", range: { startPct: 10, endPct: 20 } },
      { key: "b", range: { startPct: 30, endPct: 40 } },
    ]);

    expect(lanes.get("a")).toEqual({ lane: 0, laneCount: 1 });
    expect(lanes.get("b")).toEqual({ lane: 0, laneCount: 1 });
  });

  it("splits overlapping events side-by-side", () => {
    const lanes = assignTimedEventLanes([
      { key: "a", range: { startPct: 10, endPct: 50 } },
      { key: "b", range: { startPct: 20, endPct: 30 } },
    ]);

    expect(lanes.get("a")).toEqual({ lane: 0, laneCount: 2 });
    expect(lanes.get("b")).toEqual({ lane: 1, laneCount: 2 });
  });
});
