import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
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

function pendingLoad() {
  type Data = Awaited<ReturnType<YearViewDataSource["load"]>>;
  let resolve!: (data: Data) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<Data>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

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

  const view = renderHook(
    ({ year }) =>
      useYearViewData({
        year,
        initialYear: 2026,
        initialData: null,
        source,
        calendars: [calendar],
        dispatch,
      }),
    { initialProps: { year: 2026 } },
  );

  return { ...view, actions, state };
}

describe("useYearViewData", () => {
  it("reloads the seed year when returning from another year", async () => {
    const data = {
      calendars: [calendar],
      selectedCalendarIds: [calendar.id],
      events: [event],
      failures: [],
    };
    const load = vi.fn<YearViewDataSource["load"]>().mockResolvedValue(data);
    const source = { load, persistSelection: vi.fn<YearViewDataSource["persistSelection"]>() };
    const dispatch = vi.fn<(action: YearViewAction) => void>();
    const view = renderHook(
      ({ year }) =>
        useYearViewData({
          year,
          initialYear: 2026,
          initialData: data,
          source,
          calendars: data.calendars,
          dispatch,
        }),
      { initialProps: { year: 2026 } },
    );
    expect(load).not.toHaveBeenCalled();
    view.rerender({ year: 2027 });
    await waitFor(() => expect(load).toHaveBeenCalledWith(2027));
    view.rerender({ year: 2026 });
    await waitFor(() => expect(load).toHaveBeenLastCalledWith(2026));
  });
  it("ignores an old year that finishes after the current year", async () => {
    const old = pendingLoad();
    const current = {
      calendars: [calendar],
      selectedCalendarIds: [calendar.id],
      events: [{ ...event, id: "new-year" }],
      failures: [],
    };
    const source = {
      load: (year: number) => (year === 2026 ? old.promise : Promise.resolve(current)),
      persistSelection: vi.fn<YearViewDataSource["persistSelection"]>(),
    };
    const view = setup(source);
    view.rerender({ year: 2027 });
    await waitFor(() => expect(view.state.current.events).toEqual(current.events));
    await act(async () => old.resolve({ ...current, events: [event] }));
    expect(view.state.current.events).toEqual(current.events);
  });

  it("ignores a superseded refresh failure", async () => {
    const old = pendingLoad();
    const data = {
      calendars: [calendar],
      selectedCalendarIds: [calendar.id],
      events: [event],
      failures: [],
    };
    const source = {
      load: vi
        .fn<YearViewDataSource["load"]>()
        .mockReturnValueOnce(old.promise)
        .mockResolvedValue(data),
      persistSelection: vi.fn<YearViewDataSource["persistSelection"]>(),
    };
    const view = setup(source);
    await act(async () => view.result.current.handleReloadCalendars());
    await waitFor(() => expect(view.state.current.events).toEqual([event]));
    await act(async () => old.reject(new Error("stale failure")));
    expect(view.state.current.error).toBeNull();
  });

  it("preserves a selection made while a refresh is pending", async () => {
    const pending = pendingLoad();
    const view = setup({
      load: () => pending.promise,
      persistSelection: vi.fn<YearViewDataSource["persistSelection"]>(),
    });
    view.result.current.updateSelectedCalendars([]);
    await act(async () =>
      pending.resolve({
        calendars: [calendar],
        selectedCalendarIds: [calendar.id],
        events: [event],
        failures: [],
      }),
    );
    expect(view.state.current.selectedCalendarIds).toEqual([]);
  });

  it("does not dispatch after unmount", async () => {
    const pending = pendingLoad();
    const view = setup({
      load: () => pending.promise,
      persistSelection: vi.fn<YearViewDataSource["persistSelection"]>(),
    });
    view.unmount();
    const count = view.actions.length;
    await act(async () =>
      pending.resolve({ calendars: [], selectedCalendarIds: [], events: [], failures: [] }),
    );
    expect(view.actions).toHaveLength(count);
  });

  it("applies a successful load", async () => {
    const source: YearViewDataSource = {
      load: () =>
        Promise.resolve({
          calendars: [calendar],
          selectedCalendarIds: ["cal-1"],
          events: [event],
          failures: [],
        }),
      persistSelection: vi.fn<YearViewDataSource["persistSelection"]>(),
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
      persistSelection: vi.fn<YearViewDataSource["persistSelection"]>(),
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
      persistSelection: vi.fn<YearViewDataSource["persistSelection"]>(),
    };

    const { state } = setup(source);

    await waitFor(() => expect(state.current.isRefreshing).toBe(false));
    expect(state.current.loading).toBe(false);
  });

  it("routes calendar selection changes through the source", () => {
    const persistSelection = vi.fn<YearViewDataSource["persistSelection"]>();
    const source: YearViewDataSource = {
      load: () =>
        Promise.resolve({
          calendars: [calendar],
          selectedCalendarIds: ["cal-1"],
          events: [],
          failures: [],
        }),
      persistSelection,
    };

    const { result, state } = setup(source);

    result.current.updateSelectedCalendars([]);
    expect(persistSelection).toHaveBeenCalledWith(["cal-1"], []);
    expect(state.current.selectedCalendarIds).toEqual([]);
  });
});
