import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useYearViewData } from "@/components/year-view/use-year-view-data";
import type { YearViewDataSource } from "@/components/year-view/year-view-ports";
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

function setup(source: YearViewDataSource) {
  const setters = {
    setEvents: vi.fn(),
    setLoading: vi.fn(),
    setIsRefreshing: vi.fn(),
    setError: vi.fn(),
    setHasHydratedData: vi.fn(),
    setCalendars: vi.fn(),
    setSelectedCalendarIds: vi.fn(),
  };

  const view = renderHook(() =>
    useYearViewData({
      year: 2026,
      initialYear: 2026,
      initialData: null,
      source,
      calendars: [calendar],
      ...setters,
    }),
  );

  return { ...view, ...setters };
}

describe("useYearViewData", () => {
  it("applies a successful load", async () => {
    const source: YearViewDataSource = {
      load: () =>
        Promise.resolve({
          calendars: [calendar],
          selectedCalendarIds: ["cal-1"],
          events: [event],
        }),
      persistSelection: vi.fn(),
    };

    const { setCalendars, setEvents, setHasHydratedData } = setup(source);

    await waitFor(() => expect(setHasHydratedData).toHaveBeenCalledWith(true));
    expect(setCalendars).toHaveBeenCalledWith([calendar]);
    expect(setEvents).toHaveBeenCalledWith([event]);
  });

  it("keeps whatever is on screen when a load fails", async () => {
    // A dropped request during a refresh or a post-mutation reconcile must not
    // blank the year or discard the visitor's calendar selection — the error in
    // the sidebar is feedback enough.
    const source: YearViewDataSource = {
      load: () => Promise.reject(new Error("network down")),
      persistSelection: vi.fn(),
    };

    const { setCalendars, setEvents, setSelectedCalendarIds, setError, setHasHydratedData } =
      setup(source);

    await waitFor(() => expect(setError).toHaveBeenCalledWith("network down"));
    expect(setCalendars).not.toHaveBeenCalled();
    expect(setEvents).not.toHaveBeenCalled();
    expect(setSelectedCalendarIds).not.toHaveBeenCalled();
    // Still hydrated, so a first-load failure shows the error rather than
    // spinning forever.
    expect(setHasHydratedData).toHaveBeenCalledWith(true);
  });

  it("stops the refreshing indicator whether the load succeeds or fails", async () => {
    const source: YearViewDataSource = {
      load: () => Promise.reject(new Error("boom")),
      persistSelection: vi.fn(),
    };

    const { setIsRefreshing, setLoading } = setup(source);

    await waitFor(() => expect(setIsRefreshing).toHaveBeenCalledWith(false));
    expect(setLoading).toHaveBeenCalledWith(false);
  });

  it("routes calendar selection changes through the source", () => {
    const persistSelection = vi.fn();
    const source: YearViewDataSource = {
      load: () =>
        Promise.resolve({ calendars: [calendar], selectedCalendarIds: ["cal-1"], events: [] }),
      persistSelection,
    };

    const { result, setSelectedCalendarIds } = setup(source);

    result.current.updateSelectedCalendars([]);
    expect(persistSelection).toHaveBeenCalledWith(["cal-1"], []);
    expect(setSelectedCalendarIds).toHaveBeenCalledWith([]);
  });
});
