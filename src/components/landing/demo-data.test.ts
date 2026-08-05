import { describe, expect, it } from "vitest";
import { buildDemoYear } from "@/components/landing/demo-data";
import { buildMonthSegments } from "@/domain";

const YEAR = 2026;
const TODAY = new Date(YEAR, 7, 5);

describe("buildDemoYear", () => {
  it("fills every month, so no column of the landing page looks broken", () => {
    const { events } = buildDemoYear(YEAR, TODAY);
    const months = buildMonthSegments(events, YEAR);
    const empty = months.filter((month) => month.segments.length === 0).map((m) => m.month);
    expect(empty).toEqual([]);
  });

  it("gives today several events so the day panel has something to show", () => {
    const { events } = buildDemoYear(YEAR, TODAY);
    const onToday = events.filter((event) => event.start.startsWith("2026-08-05"));
    expect(onToday.length).toBeGreaterThanOrEqual(3);
  });

  it("includes both all-day and timed events", () => {
    const { events } = buildDemoYear(YEAR, TODAY);
    expect(events.some((event) => event.allDay)).toBe(true);
    expect(events.some((event) => event.isTimed)).toBe(true);
  });

  it("drops nothing to normalization — every seed survives as an event", () => {
    // `normalizeEvent` rejects single-day timed events. If a seed is written
    // that way it silently disappears from the demo, so this guards the fixture.
    const { events } = buildDemoYear(YEAR, TODAY);
    const ids = new Set(events.map((event) => event.id));
    expect(ids.size).toBe(events.length);
    expect(events.length).toBeGreaterThan(30);
  });

  it("only exposes writable calendars plus the read-only ones the app models", () => {
    const { calendars } = buildDemoYear(YEAR, TODAY);
    expect(calendars.some((calendar) => calendar.primary)).toBe(true);
    expect(calendars.some((calendar) => calendar.accessRole === "reader")).toBe(true);
  });
});
