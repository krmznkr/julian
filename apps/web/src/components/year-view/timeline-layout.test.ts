import { describe, expect, it } from "vitest";
import { buildTimelineRows, TIMELINE_ZOOMS, type CalendarEvent } from "@julian/domain";
import {
  adjacentTimelineBar,
  firstVisibleTimelineBar,
  formatTimelineRange,
  stepZoom,
  timelineDayWidth,
  timelineLabelMode,
  timelineLabelWidth,
  timelineReserveDays,
  windowStartIndex,
} from "@/components/year-view/timeline-layout";

function event(id: string, calendarId: string, start: string, end: string): CalendarEvent {
  return { id, title: id, calendarId, start, end, allDay: true, isTimed: false };
}

const rows = buildTimelineRows(
  [
    event("a1", "a", "2026-01-05", "2026-01-06"),
    event("a2", "a", "2026-02-10", "2026-02-12"),
    event("c1", "c", "2026-02-01", "2026-02-02"),
    event("c2", "c", "2026-03-01", "2026-03-02"),
  ],
  ["a", "b", "c"],
  2026,
);

describe("timeline sizing", () => {
  it("narrows the calendar column on phones", () => {
    expect(timelineLabelWidth(390)).toBe(96);
    expect(timelineLabelWidth(1440)).toBe(176);
  });

  it("fits the zoom's window into the track, with a floor", () => {
    expect(timelineDayWidth(176 + 700, "week", 2026)).toBe(100);
    expect(timelineDayWidth(390, "year", 2026)).toBe(2);
    // A phone keeps days wide enough to read and scrolls the quarter instead.
    expect(timelineDayWidth(412, "quarter", 2026)).toBe(6);
  });

  it("steps zoom within the list", () => {
    expect(stepZoom(TIMELINE_ZOOMS, "quarter", -1)).toBe("month");
    expect(stepZoom(TIMELINE_ZOOMS, "week", -1)).toBe("week");
    expect(stepZoom(TIMELINE_ZOOMS, "year", 1)).toBe("year");
  });

  it("keeps window starts inside the year", () => {
    // Jan 1 2026 is a Thursday; its week starts in 2025.
    expect(windowStartIndex("week", new Date(2026, 0, 1), 2026)).toBe(0);
    expect(windowStartIndex("quarter", new Date(2026, 4, 20), 2026)).toBe(90);
  });
});

describe("bar titles", () => {
  it("puts a title inside wide bars and beside narrow ones", () => {
    expect(timelineLabelMode(200, "Sprint")).toBe("inside");
    expect(timelineLabelMode(10, "Sprint")).toBe("outside");
  });

  it("reserves lane room only for titles drawn beside the bar", () => {
    expect(timelineReserveDays("Sprint", 10, 20)).toBe(0);
    expect(timelineReserveDays("Sprint", 1, 10)).toBe(1 + Math.ceil((56 + 6) / 10));
  });
});

describe("formatTimelineRange", () => {
  it("names whole months, quarters and years", () => {
    expect(formatTimelineRange(2026, 304, 333)).toBe("November 2026");
    expect(formatTimelineRange(2026, 273, 364)).toBe("Oct – Dec 2026");
    expect(formatTimelineRange(2026, 0, 364)).toBe("2026");
  });

  it("names partial ranges by day", () => {
    expect(formatTimelineRange(2026, 305, 311)).toBe("Nov 2 – 8, 2026");
    expect(formatTimelineRange(2026, 333, 339)).toBe("Nov 30 – Dec 6, 2026");
  });

  it("clamps past the year's end", () => {
    expect(formatTimelineRange(2026, 360, 400)).toBe("Dec 27 – 31, 2026");
  });
});

describe("adjacentTimelineBar", () => {
  it("walks a calendar's bars left and right, and to either end", () => {
    expect(adjacentTimelineBar(rows, "a::a1", "right")).toBe("a::a2");
    expect(adjacentTimelineBar(rows, "a::a2", "left")).toBe("a::a1");
    expect(adjacentTimelineBar(rows, "a::a2", "right")).toBeNull();
    expect(adjacentTimelineBar(rows, "a::a2", "home")).toBe("a::a1");
    expect(adjacentTimelineBar(rows, "a::a1", "end")).toBe("a::a2");
  });

  it("skips empty calendars and picks the nearest start going up or down", () => {
    expect(adjacentTimelineBar(rows, "a::a2", "down")).toBe("c::c1");
    expect(adjacentTimelineBar(rows, "c::c2", "up")).toBe("a::a2");
    expect(adjacentTimelineBar(rows, "a::a1", "up")).toBeNull();
    expect(adjacentTimelineBar(rows, "c::c1", "down")).toBeNull();
  });

  it("returns null for an unknown bar", () => {
    expect(adjacentTimelineBar(rows, "missing", "right")).toBeNull();
  });
});

describe("firstVisibleTimelineBar", () => {
  it("prefers the first bar still on screen, else the first bar", () => {
    expect(firstVisibleTimelineBar(rows, 30)).toBe("a::a2");
    expect(firstVisibleTimelineBar(rows, 300)).toBe("a::a1");
    expect(firstVisibleTimelineBar([], 0)).toBeNull();
  });
});
