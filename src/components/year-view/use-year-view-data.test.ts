import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  createInitialState,
  yearViewReducer,
  type YearViewAction,
  type YearViewState,
} from "@/components/year-view-reducer";
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

/**
 * Feeds the hook's dispatches through the real reducer so assertions are about
 * observable state, not about which setter happened to be called.
 */
function setup(source: YearViewDataSource, seed?: Partial<YearViewState>) {
  const actions: YearViewAction[] = [];
  const state = {
    current: { ...createInitialState({ year: 2026 }), ...seed },
  };

  const dispatch = (action: YearViewAction) => {
    actions.push(action);

    state.current = yearViewReducer(state.current, action);
  };

  const view = renderHook(() =>
    useYearViewData({
      year: 2026,
      initialYear: 2026,
      initialData: null,
      source,
      calendars: [calendar],
      dispatch,
    }),
  );

  return { ...view, actions, state };
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

    const { state } = setup(source);

    await waitFor(() => expect(state.current.hasHydratedData).toBe(true));
    expect(state.current.calendars).toEqual([calendar]);
    expect(state.current.events).toEqual([event]);
    expect(state.current.error).toBeNull();
  });

  it("keeps whatever is on screen when a load fails", async () => {
    // A dropped request during a refresh or a post-mutation reconcile must not
    // blank the year or discard the visitor's calendar selection — the error in
    // the sidebar is feedback enough.
    const source: YearViewDataSource = {
      load: () => Promise.reject(new Error("network down")),
      persistSelection: vi.fn(),
    };

    const { state } = setup(source, {
      calendars: [calendar],
      selectedCalendarIds: ["cal-1"],
      events: [event],
    });

    await waitFor(() => expect(state.current.error).toBe("network down"));
    expect(state.current.calendars).toEqual([calendar]);
    expect(state.current.events).toEqual([event]);
    expect(state.current.selectedCalendarIds).toEqual(["cal-1"]);
    // Still hydrated, so a first-load failure shows the error rather than
    // spinning forever.
    expect(state.current.hasHydratedData).toBe(true);
  });

  it("stops the refreshing indicator whether the load succeeds or fails", async () => {
    const source: YearViewDataSource = {
      load: () => Promise.reject(new Error("boom")),
      persistSelection: vi.fn(),
    };

    const { state } = setup(source);

    await waitFor(() => expect(state.current.isRefreshing).toBe(false));
    expect(state.current.loading).toBe(false);
  });

  it("routes calendar selection changes through the source", () => {
    const persistSelection = vi.fn();
    const source: YearViewDataSource = {
      load: () =>
        Promise.resolve({ calendars: [calendar], selectedCalendarIds: ["cal-1"], events: [] }),
      persistSelection,
    };

    const { result, state } = setup(source);

    result.current.updateSelectedCalendars([]);
    expect(persistSelection).toHaveBeenCalledWith(["cal-1"], []);
    expect(state.current.selectedCalendarIds).toEqual([]);
  });
});
