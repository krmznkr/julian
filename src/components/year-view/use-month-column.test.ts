import { describe, expect, it } from "vitest";
import { orderByDurationDesc } from "@/components/year-view/use-month-column";
import type { CalendarEvent } from "@/domain";

function evt(overrides: Partial<CalendarEvent> & { id: string; start: string; end: string }) {
  const event: CalendarEvent = {
    title: overrides.id,
    calendarId: "cal-1",
    allDay: true,
    isTimed: false,
    ...overrides,
  };
  return { event };
}

describe("orderByDurationDesc", () => {
  it("orders longest → shortest (multi-day, then all-day, then timed)", () => {
    const multiDay = evt({ id: "trip", start: "2026-03-01", end: "2026-03-12" });
    const allDay = evt({ id: "holiday", start: "2026-03-05", end: "2026-03-06" });
    const timedLong = evt({
      id: "meeting",
      start: "2026-03-05T09:00:00Z",
      end: "2026-03-05T13:00:00Z",
      allDay: false,
      isTimed: true,
    });
    const timedShort = evt({
      id: "call",
      start: "2026-03-05T15:00:00Z",
      end: "2026-03-05T15:30:00Z",
      allDay: false,
      isTimed: true,
    });

    const ordered = orderByDurationDesc([timedShort, allDay, timedLong, multiDay]);
    expect(ordered.map((o) => o.event.id)).toEqual(["trip", "holiday", "meeting", "call"]);
  });

  it("breaks ties by title for stable ordering", () => {
    const a = evt({ id: "b-event", title: "B", start: "2026-03-05", end: "2026-03-06" });
    const b = evt({ id: "a-event", title: "A", start: "2026-03-05", end: "2026-03-06" });
    const ordered = orderByDurationDesc([a, b]);
    expect(ordered.map((o) => o.event.title)).toEqual(["A", "B"]);
  });
});
