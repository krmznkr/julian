import { describe, expect, it } from "vitest";
import {
  createInitialState,
  yearViewReducer,
  type YearViewState,
} from "@/components/year-view-reducer";
import type { CalendarEvent, CalendarSummary } from "@/domain";

const calendar: CalendarSummary = { id: "cal-1", summary: "Personal", accessRole: "owner" };
const otherCalendar: CalendarSummary = { id: "cal-2", summary: "Work", accessRole: "reader" };

const event: CalendarEvent = {
  id: "e1",
  title: "Trip",
  start: "2026-03-01",
  end: "2026-03-04",
  allDay: true,
  isTimed: false,
  calendarId: "cal-1",
};

const loaded = (overrides?: Partial<YearViewState>): YearViewState => ({
  ...createInitialState({
    year: 2026,
    calendars: [calendar],
    selectedCalendarIds: ["cal-1"],
    events: [event],
  }),
  ...overrides,
});

describe("createInitialState", () => {
  it("starts unhydrated and loading when there is no seed data", () => {
    const state = createInitialState({ year: 2026 });
    expect(state).toMatchObject({
      year: 2026,
      loading: true,
      hasHydratedData: false,
      isRefreshing: false,
      error: null,
    });
    expect(state.calendars).toEqual([]);
  });

  it("starts hydrated when seeded, so the landing page paints no skeleton", () => {
    const state = createInitialState({ year: 2026, calendars: [calendar], events: [event] });
    expect(state.loading).toBe(false);
    expect(state.hasHydratedData).toBe(true);
  });
});

describe("yearViewReducer — loading", () => {
  it("clears a stale error when a load starts", () => {
    const state = yearViewReducer(loaded({ error: "boom" }), { type: "LOAD_STARTED" });
    expect(state).toMatchObject({ isRefreshing: true, error: null });
  });

  it("replaces the year wholesale on success", () => {
    const state = yearViewReducer(createInitialState({ year: 2026 }), {
      type: "LOAD_SUCCEEDED",
      calendars: [calendar, otherCalendar],
      selectedCalendarIds: ["cal-1"],
      events: [event],
    });

    expect(state).toMatchObject({
      loading: false,
      hasHydratedData: true,
      isRefreshing: false,
      error: null,
    });
    expect(state.calendars).toEqual([calendar, otherCalendar]);
    expect(state.events).toEqual([event]);
  });

  it("keeps calendars, events and selection when a load fails", () => {
    // A dropped refresh must not blank the year the visitor is looking at.
    const before = loaded();
    const state = yearViewReducer(before, { type: "LOAD_FAILED", message: "network down" });

    expect(state.error).toBe("network down");
    expect(state.calendars).toEqual(before.calendars);
    expect(state.events).toEqual(before.events);
    expect(state.selectedCalendarIds).toEqual(before.selectedCalendarIds);
  });

  it("hydrates even when the first load fails, so the sidebar can offer a retry", () => {
    const state = yearViewReducer(createInitialState({ year: 2026 }), {
      type: "LOAD_FAILED",
      message: "network down",
    });
    expect(state).toMatchObject({ loading: false, hasHydratedData: true, isRefreshing: false });
  });
});

describe("yearViewReducer — events", () => {
  it("appends a created event", () => {
    const created: CalendarEvent = { ...event, id: "e2", title: "Dentist" };
    const state = yearViewReducer(loaded(), { type: "EVENT_CREATED", event: created });
    expect(state.events).toEqual([event, created]);
  });

  it("patches only the named event", () => {
    const state = yearViewReducer(loaded({ events: [event, { ...event, id: "e2" }] }), {
      type: "EVENT_UPDATED",
      id: "e2",
      changes: { title: "Renamed" },
    });
    expect(state.events.map((e) => e.title)).toEqual(["Trip", "Renamed"]);
  });

  it("removes a deleted event", () => {
    const state = yearViewReducer(loaded(), { type: "EVENT_DELETED", id: "e1" });
    expect(state.events).toEqual([]);
  });
});

describe("yearViewReducer — identity", () => {
  // These actions fire from scroll and resize handlers, so returning a fresh
  // object for an unchanged value would re-render the grid every frame.
  it("returns the same state when scroll edges are unchanged", () => {
    const before = loaded({ scrollEdges: { left: true, right: false } });
    expect(
      yearViewReducer(before, {
        type: "SCROLL_EDGES_CHANGED",
        edges: { left: true, right: false },
      }),
    ).toBe(before);
  });

  it("returns a new state when scroll edges actually move", () => {
    const before = loaded({ scrollEdges: { left: false, right: false } });
    const after = yearViewReducer(before, {
      type: "SCROLL_EDGES_CHANGED",
      edges: { left: true, right: false },
    });
    expect(after).not.toBe(before);
    expect(after.scrollEdges).toEqual({ left: true, right: false });
  });

  it("returns the same state when the year is unchanged", () => {
    const before = loaded();
    expect(yearViewReducer(before, { type: "YEAR_CHANGED", year: 2026 })).toBe(before);
  });

  it("returns the same state when dismissing an error that is not there", () => {
    const before = loaded();
    expect(yearViewReducer(before, { type: "ERROR_DISMISSED" })).toBe(before);
  });
});

describe("yearViewReducer — chrome", () => {
  it("records the calendar selection", () => {
    const state = yearViewReducer(loaded(), {
      type: "CALENDAR_SELECTION_CHANGED",
      selectedCalendarIds: [],
    });
    expect(state.selectedCalendarIds).toEqual([]);
  });

  it("tracks sidebar and mobile sidebar visibility", () => {
    const collapsed = yearViewReducer(loaded(), {
      type: "SIDEBAR_COLLAPSED_CHANGED",
      collapsed: true,
    });
    expect(collapsed.sidebarCollapsed).toBe(true);

    const opened = yearViewReducer(collapsed, { type: "MOBILE_SIDEBAR_OPEN_CHANGED", open: true });
    expect(opened.mobileSidebarOpen).toBe(true);
  });
});
