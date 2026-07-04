import { describe, it, expect } from "vitest";
import { buildMonthSegments, durationInDays } from "./index";
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

describe("buildMonthSegments", () => {
  it("returns 12 months with empty segments when no events", () => {
    const result = buildMonthSegments([], 2026);
    expect(result).toHaveLength(12);
    result.forEach((month, i) => {
      expect(month.month).toBe(i);
      expect(month.segments).toHaveLength(0);
      expect(month.lanes).toBe(0);
    });
  });

  it("gives single-day events lane 0 and counts no lanes for them", () => {
    const events: CalendarEvent[] = [
      event({ id: "a", title: "Day A", start: "2026-04-10", end: "2026-04-11" }),
      event({ id: "b", title: "Day B", start: "2026-04-10", end: "2026-04-11" }),
    ];
    const april = buildMonthSegments(events, 2026)[3];
    expect(april.segments).toHaveLength(2);
    expect(april.segments.every((s) => s.startDay === 10 && s.endDay === 10)).toBe(true);
    expect(april.segments.every((s) => s.lane === 0)).toBe(true);
    expect(april.lanes).toBe(0);
  });

  it("places single event in one month with correct startDay/endDay and lane 1", () => {
    const events: CalendarEvent[] = [
      event({
        id: "e1",
        title: "Single",
        start: "2026-03-05",
        end: "2026-03-10",
      }),
    ];
    const result = buildMonthSegments(events, 2026);
    expect(result[2].segments).toHaveLength(1);
    expect(result[2].segments[0].startDay).toBe(5);
    expect(result[2].segments[0].endDay).toBe(9);
    expect(result[2].segments[0].lane).toBe(1);
    expect(result[2].lanes).toBe(1);
  });

  it("splits event spanning multiple months into segments per month", () => {
    const events: CalendarEvent[] = [
      event({
        id: "e1",
        title: "Span",
        start: "2026-01-28",
        end: "2026-02-05",
      }),
    ];
    const result = buildMonthSegments(events, 2026);
    const jan = result[0];
    const feb = result[1];
    expect(jan.segments).toHaveLength(1);
    expect(jan.segments[0].startDay).toBe(28);
    expect(jan.segments[0].endDay).toBe(31); // Jan 28–31 (end exclusive Feb 1 → endDay 31)
    expect(feb.segments).toHaveLength(1);
    expect(feb.segments[0].startDay).toBe(1);
    expect(feb.segments[0].endDay).toBe(4);
  });

  it("renders a legacy all-day ISO one-day event in exactly one day cell", () => {
    const events: CalendarEvent[] = [
      event({
        id: "e-legacy",
        title: "Legacy one-day",
        start: "2026-01-15T00:00:00.000Z",
        end: "2026-01-16T00:00:00.000Z",
      }),
    ];
    const result = buildMonthSegments(events, 2026);
    expect(result[0].segments).toHaveLength(1);
    expect(result[0].segments[0].startDay).toBe(15);
    expect(result[0].segments[0].endDay).toBe(15);
  });

  it("assigns overlapping events to different lanes", () => {
    const events: CalendarEvent[] = [
      event({
        id: "e1",
        title: "First",
        start: "2026-06-05",
        end: "2026-06-15",
      }),
      event({
        id: "e2",
        title: "Overlap",
        start: "2026-06-10",
        end: "2026-06-20",
      }),
    ];
    const result = buildMonthSegments(events, 2026);
    const june = result[5];
    expect(june.segments).toHaveLength(2);
    const lanes = june.segments.map((s) => s.lane);
    expect(lanes).toContain(1);
    expect(lanes).toContain(2);
    expect(june.lanes).toBe(2);
  });

  it("prioritizes longer overlapping event in lower lane when start day matches", () => {
    const events: CalendarEvent[] = [
      event({
        id: "e-short",
        title: "Short",
        start: "2026-01-01",
        end: "2026-01-06",
      }),
      event({
        id: "e-long",
        title: "Long",
        start: "2026-01-01",
        end: "2026-01-12",
      }),
    ];
    const result = buildMonthSegments(events, 2026);
    const january = result[0];
    const longSegment = january.segments.find((s) => s.id === "cal-1::e-long");
    const shortSegment = january.segments.find((s) => s.id === "cal-1::e-short");
    expect(longSegment?.lane).toBe(1);
    expect(shortSegment?.lane).toBe(2);
  });

  it("assigns non-overlapping events to same lane", () => {
    const events: CalendarEvent[] = [
      event({
        id: "e1",
        title: "First",
        start: "2026-07-01",
        end: "2026-07-05",
      }),
      event({
        id: "e2",
        title: "Second",
        start: "2026-07-10",
        end: "2026-07-15",
      }),
    ];
    const result = buildMonthSegments(events, 2026);
    const july = result[6];
    expect(july.segments).toHaveLength(2);
    expect(july.segments.every((s) => s.lane === 1)).toBe(true);
    expect(july.lanes).toBe(1);
  });
});

describe("durationInDays", () => {
  it("returns full days between two dates (ceil)", () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 5);
    expect(durationInDays(start, end)).toBe(4);
  });

  it("returns 1 for same-day span (end at midnight next day)", () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 0, 2);
    expect(durationInDays(start, end)).toBe(1);
  });

  it("rounds up partial days", () => {
    const start = new Date(2026, 0, 1, 0, 0, 0);
    const end = new Date(2026, 0, 2, 12, 0, 0);
    expect(durationInDays(start, end)).toBe(2);
  });
});
