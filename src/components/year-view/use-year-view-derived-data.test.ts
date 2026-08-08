import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useYearViewDerivedData } from "@/components/year-view/use-year-view-derived-data";
import type { CalendarEvent, CalendarSummary } from "@/domain";

const calendar: CalendarSummary = { id: "cal-1", summary: "Personal", accessRole: "owner" };

const event: CalendarEvent = {
  id: "e1",
  title: "Trip",
  start: "2026-03-01",
  end: "2026-03-04",
  allDay: true,
  isTimed: false,
  calendarId: "cal-1",
};

const formatDate = (date: Date) => date.toISOString();

function derive(overrides: Partial<Parameters<typeof useYearViewDerivedData>[0]> = {}) {
  return renderHook(() =>
    useYearViewDerivedData({
      calendars: [calendar],
      events: [event],
      failures: [],
      formatDate,
      isRefreshing: false,
      selectedCalendarIds: ["cal-1"],
      year: 2026,
      ...overrides,
    }),
  ).result.current;
}

describe("useYearViewDerivedData — sync badge", () => {
  it("reports a healthy load", () => {
    expect(derive().syncBadge).toEqual({ kind: "synced", label: "Local" });
  });

  it("reports an in-flight load", () => {
    expect(derive({ isRefreshing: true }).syncBadge.kind).toBe("syncing");
  });

  // The year still renders when one calendar fails, so without this the visitor
  // sees a complete-looking calendar with events silently missing from it.
  it("names the single source that failed", () => {
    expect(derive({ failures: [{ source: "Work", message: "403" }] }).syncBadge).toEqual({
      kind: "issues",
      label: "Could not load Work",
    });
  });

  it("counts multiple failed sources", () => {
    const badge = derive({
      failures: [
        { source: "Work", message: "403" },
        { source: "Tasks", message: "500" },
      ],
    }).syncBadge;
    expect(badge).toEqual({ kind: "issues", label: "Could not load 2 calendars" });
  });

  it("prefers the in-flight state while refreshing after a failure", () => {
    const badge = derive({
      isRefreshing: true,
      failures: [{ source: "Work", message: "403" }],
    }).syncBadge;
    expect(badge.kind).toBe("syncing");
  });
});

describe("useYearViewDerivedData — visibility", () => {
  it("hides events from deselected calendars", () => {
    expect(derive({ selectedCalendarIds: [] }).visibleEvents).toEqual([]);
  });

  it("reports selected calendars that the source no longer knows about", () => {
    expect(
      derive({ selectedCalendarIds: ["cal-1", "gone"] }).unresolvedSelectedCalendarIds,
    ).toEqual(["gone"]);
  });
});
