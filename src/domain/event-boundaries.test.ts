import { describe, expect, it } from "vitest";
import {
  buildMonthSegments,
  getEventBounds,
  isTimedMultiDayEvent,
  parseEventBoundary,
  type CalendarEvent,
} from "@/domain";
import { eventCalendarSpanDays, formatDateRange } from "@/components/year-helpers";

const event = (start: string, end: string, allDay = false): CalendarEvent => ({
  id: "event",
  calendarId: "cal",
  title: "Event",
  start,
  end,
  allDay,
  isTimed: !allDay,
});

describe("exclusive end boundaries", () => {
  it("keeps a late event ending at midnight on just its start day", () => {
    const item = event("2026-06-15T22:00:00", "2026-06-16T00:00:00");
    const month = buildMonthSegments([item], 2026)[5];
    expect(month.segments[0]).toMatchObject({
      startDay: 15,
      endDay: 15,
      lane: 0,
      isMultiDay: false,
    });
    expect(eventCalendarSpanDays(item)).toBe(1);
    expect(formatDateRange(item)).toBe("Jun 15");
    expect(isTimedMultiDayEvent(new Date(item.start), new Date(item.end))).toBe(false);
  });

  it("counts a short overnight event on both touched dates", () => {
    const item = event("2026-06-15T23:30:00", "2026-06-16T00:30:00");
    expect(buildMonthSegments([item], 2026)[5].segments[0]).toMatchObject({
      startDay: 15,
      endDay: 16,
      lane: 1,
      isMultiDay: true,
    });
    expect(eventCalendarSpanDays(item)).toBe(2);
    expect(formatDateRange(item)).toBe("Jun 15 – Jun 16");
  });

  it("keeps one-day month tails in the multi-day lanes", () => {
    const months = buildMonthSegments([event("2026-05-31", "2026-06-02", true)], 2026);
    expect(months[4].segments[0]).toMatchObject({
      startDay: 31,
      endDay: 31,
      lane: 1,
      isFirstSegment: true,
      isLastSegment: false,
    });
    expect(months[5].segments[0]).toMatchObject({
      startDay: 1,
      endDay: 1,
      lane: 1,
      isFirstSegment: false,
      isLastSegment: true,
    });
    expect(months[4].lanes).toBe(1);
    expect(months[5].lanes).toBe(1);
  });

  it("does not invent an extra segment at a midnight month boundary", () => {
    const months = buildMonthSegments([event("2026-05-31T23:00:00", "2026-06-01T00:00:00")], 2026);
    expect(months[4].segments[0]).toMatchObject({ startDay: 31, endDay: 31, isMultiDay: false });
    expect(months[5].segments).toEqual([]);
  });

  it("marks year-clipped bars as continuations", () => {
    const months = buildMonthSegments([event("2025-12-31", "2027-01-02", true)], 2026);
    expect(months[0].segments[0].isFirstSegment).toBe(false);
    expect(months[11].segments[0].isLastSegment).toBe(false);
  });

  it.each(["2026-03-08", "2026-03-29", "2026-10-25", "2026-11-01"])(
    "counts one calendar day across DST on %s",
    (day) => {
      const [year, month, date] = day.split("-").map(Number);
      const start = new Date(year, month - 1, date, 0);
      const end = new Date(year, month - 1, date + 1, 0);
      const item = event(start.toISOString(), end.toISOString());
      expect(getEventBounds(item)?.spanDays).toBe(1);
      expect(buildMonthSegments([item], year)[month - 1].segments[0]).toMatchObject({
        startDay: date,
        endDay: date,
        lane: 0,
      });
    },
  );

  it("does not reinterpret an all-day date as a UTC instant", () => {
    const item = event("2026-06-10", "2026-06-11", true);
    expect(buildMonthSegments([item], 2026)[5].segments[0]).toMatchObject({
      startDay: 10,
      endDay: 10,
    });
    expect(parseEventBoundary("2026-06-10T00:00:00+14:00", true).getDate()).toBe(10);
  });

  it.each(["2026-02-30", "2026-04-31", "not-a-date"])(
    "rejects invalid calendar date %s",
    (start) => {
      expect(
        buildMonthSegments([event(start, "2026-05-01", true)], 2026).flatMap(
          (month) => month.segments,
        ),
      ).toEqual([]);
    },
  );
});

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const expectedPlacement: Record<string, { startDay: number; endDay: number; lane: number }> = {
  UTC: { startDay: 9, endDay: 9, lane: 0 },
  "America/Los_Angeles": { startDay: 9, endDay: 9, lane: 0 },
  "Europe/Paris": { startDay: 10, endDay: 10, lane: 0 },
  "Pacific/Auckland": { startDay: 10, endDay: 10, lane: 0 },
  "Africa/Casablanca": { startDay: 9, endDay: 10, lane: 1 },
};
it.runIf(zone in expectedPlacement)(
  "places Google's offset timestamps in the displayed local timezone",
  () => {
    const item = event("2026-06-10T00:30:00+02:00", "2026-06-10T01:30:00+02:00");
    expect(buildMonthSegments([item], 2026)[5].segments[0]).toMatchObject(expectedPlacement[zone]);
  },
);
