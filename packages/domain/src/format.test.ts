import { describe, expect, it } from "vitest";
import {
  eventCalendarSpanDays,
  formatDateRange,
  formatTimeRange,
  isWeekend,
  toUtcDateOnly,
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

const timed = (start: string, end: string) => event({ start, end, allDay: false, isTimed: true });

describe("formatDateRange", () => {
  it("shows a single day for a one-day all-day event", () => {
    expect(formatDateRange(event({ start: "2026-03-04", end: "2026-03-05" }))).toBe("Mar 4");
  });

  it("shows the last occupied day, not the exclusive end", () => {
    expect(formatDateRange(event({ start: "2026-03-04", end: "2026-03-07" }))).toBe(
      "Mar 4 – Mar 6",
    );
  });

  it("reports invalid dates instead of throwing", () => {
    expect(formatDateRange(event({ start: "nope", end: "2026-03-07" }))).toBe(
      "Invalid event dates",
    );
  });
});

describe("formatTimeRange", () => {
  it("labels all-day events", () => {
    expect(formatTimeRange(event({ start: "2026-03-04", end: "2026-03-05" }))).toBe("All day");
  });

  it("formats local start and end times", () => {
    expect(formatTimeRange(timed("2026-03-04T09:30:00", "2026-03-04T14:00:00"))).toBe(
      "9:30 AM – 2:00 PM",
    );
  });
});

describe("eventCalendarSpanDays", () => {
  it("counts calendar days and returns 0 for invalid events", () => {
    expect(eventCalendarSpanDays(event({ start: "2026-03-04", end: "2026-03-07" }))).toBe(3);
    expect(eventCalendarSpanDays(event({ start: "bad", end: "bad" }))).toBe(0);
  });
});

describe("isWeekend", () => {
  it("is true on Saturday and Sunday only", () => {
    expect(isWeekend(2026, 2, 7)).toBe(true);
    expect(isWeekend(2026, 2, 8)).toBe(true);
    expect(isWeekend(2026, 2, 9)).toBe(false);
  });
});

describe("toUtcDateOnly", () => {
  it("serialises the UTC calendar date with zero padding", () => {
    expect(toUtcDateOnly(new Date(Date.UTC(2026, 0, 5, 23, 59)))).toBe("2026-01-05");
  });
});
