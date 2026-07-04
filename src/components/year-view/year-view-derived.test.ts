import { describe, expect, it } from "vitest";
import {
  buildDisplayEventMap,
  buildDisplayEvents,
  buildMonthNames,
  buildSourceEventMap,
  getDefaultCalendarId,
  getUnresolvedSelectedCalendarIds,
} from "@/components/year-view/year-view-derived";
import type { CalendarEvent, CalendarSummary } from "@/domain";

const baseEvents: CalendarEvent[] = [
  {
    id: "event-1",
    title: "Roadmap",
    start: "2026-01-10",
    end: "2026-01-12",
    allDay: true,
    isTimed: false,
    calendarId: "cal-1",
  },
];

const baseCalendars: CalendarSummary[] = [
  { id: "cal-1", summary: "Work" },
  { id: "cal-2", summary: "Personal" },
];

describe("year-view-derived", () => {
  it("builds translated month names", () => {
    const monthNames = buildMonthNames((key) => key.toUpperCase());
    expect(monthNames).toHaveLength(12);
    expect(monthNames[0]).toBe("CALENDAR.MONTHS.JANUARY");
    expect(monthNames[11]).toBe("CALENDAR.MONTHS.DECEMBER");
  });

  it("builds source and display event maps keyed by calendar and event id", () => {
    const sourceMap = buildSourceEventMap(baseEvents);
    const displayMap = buildDisplayEventMap(baseEvents);

    expect(sourceMap.get("cal-1::event-1")?.title).toBe("Roadmap");
    expect(displayMap.get("cal-1::event-1")?.title).toBe("Roadmap");
  });

  it("applies preview ranges to display events only", () => {
    const displayEvents = buildDisplayEvents(baseEvents, {
      "cal-1::event-1": {
        start: "2026-01-11",
        endExclusive: "2026-01-13",
      },
    });

    expect(displayEvents[0]?.start).toBe("2026-01-11");
    expect(displayEvents[0]?.end).toBe("2026-01-13");
    expect(baseEvents[0]?.start).toBe("2026-01-10");
  });

  it("detects unresolved selected calendars", () => {
    expect(getUnresolvedSelectedCalendarIds(baseCalendars, ["cal-1", "missing"])).toEqual([
      "missing",
    ]);
  });

  it("prefers selected calendars when choosing the default calendar id", () => {
    expect(getDefaultCalendarId(baseCalendars, ["cal-2"])).toBe("cal-2");
    expect(getDefaultCalendarId(baseCalendars, [])).toBe("cal-1");
    expect(getDefaultCalendarId([], [])).toBe("");
  });
});
