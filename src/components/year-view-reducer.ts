/**
 * The year view's state, as a single reducer.
 *
 * Actions name *what happened*, not which field to poke. That matters most for
 * loading: one `LOAD_SUCCEEDED` replaces the six separate setter calls the view
 * used to fire per refresh, so the "hydrated but still refreshing" and "failed
 * but keep what's on screen" rules live here instead of being re-derived at
 * every call site.
 */
import type { YearSourceFailure } from "@/components/year-view/year-view-ports";
import type { CalendarEvent, CalendarSummary } from "@/domain";

export type YearViewState = {
  readonly year: number;
  readonly calendars: ReadonlyArray<CalendarSummary>;
  readonly selectedCalendarIds: ReadonlyArray<string>;
  readonly events: ReadonlyArray<CalendarEvent>;
  /** True until the first load settles, successfully or not. Drives the skeleton. */
  readonly loading: boolean;
  /** True once a load has settled. A failed first load still counts. */
  readonly hasHydratedData: boolean;
  /** True while any load is in flight, including refreshes over existing data. */
  readonly isRefreshing: boolean;
  readonly error: string | null;
  /** Partial-load failures from the last successful load. */
  readonly failures: ReadonlyArray<YearSourceFailure>;
  readonly scrollEdges: { readonly left: boolean; readonly right: boolean };
  readonly sidebarCollapsed: boolean;
  readonly mobileSidebarOpen: boolean;
};

export type YearViewAction =
  | { readonly type: "YEAR_CHANGED"; readonly year: number }
  | { readonly type: "LOAD_STARTED" }
  | {
      readonly type: "LOAD_SUCCEEDED";
      readonly calendars: ReadonlyArray<CalendarSummary>;
      readonly selectedCalendarIds: ReadonlyArray<string>;
      readonly events: ReadonlyArray<CalendarEvent>;
      readonly failures: ReadonlyArray<YearSourceFailure>;
    }
  | { readonly type: "LOAD_FAILED"; readonly message: string }
  | { readonly type: "ERROR_DISMISSED" }
  | {
      readonly type: "CALENDAR_SELECTION_CHANGED";
      readonly selectedCalendarIds: ReadonlyArray<string>;
    }
  | { readonly type: "EVENT_CREATED"; readonly event: CalendarEvent }
  | {
      readonly type: "EVENT_UPDATED";
      readonly id: string;
      readonly changes: Partial<CalendarEvent>;
    }
  | { readonly type: "EVENT_DELETED"; readonly id: string }
  | {
      readonly type: "SCROLL_EDGES_CHANGED";
      readonly edges: { readonly left: boolean; readonly right: boolean };
    }
  | { readonly type: "SIDEBAR_COLLAPSED_CHANGED"; readonly collapsed: boolean }
  | { readonly type: "MOBILE_SIDEBAR_OPEN_CHANGED"; readonly open: boolean };

export type YearViewInit = {
  readonly year: number;
  readonly calendars?: ReadonlyArray<CalendarSummary>;
  readonly selectedCalendarIds?: ReadonlyArray<string>;
  readonly events?: ReadonlyArray<CalendarEvent>;
};

/**
 * Seeded from the route year plus, on the landing page, a fixture year. Having
 * fixture data means the first paint is already hydrated and must not show a
 * skeleton.
 */
export function createInitialState(init: YearViewInit): YearViewState {
  const hydrated = init.calendars != null;
  return {
    year: init.year,
    calendars: init.calendars ?? [],
    selectedCalendarIds: init.selectedCalendarIds ?? [],
    events: init.events ?? [],
    loading: !hydrated,
    hasHydratedData: hydrated,
    isRefreshing: false,
    error: null,
    failures: [],
    scrollEdges: { left: false, right: false },
    sidebarCollapsed: false,
    mobileSidebarOpen: false,
  };
}

export function yearViewReducer(state: YearViewState, action: YearViewAction): YearViewState {
  switch (action.type) {
    case "YEAR_CHANGED":
      return state.year === action.year ? state : { ...state, year: action.year };

    case "LOAD_STARTED":
      return { ...state, isRefreshing: true, error: null };

    case "LOAD_SUCCEEDED":
      return {
        ...state,
        calendars: action.calendars,
        selectedCalendarIds: action.selectedCalendarIds,
        events: action.events,
        failures: action.failures,
        loading: false,
        hasHydratedData: true,
        isRefreshing: false,
        error: null,
      };

    // Deliberately keeps calendars, events and the visitor's calendar selection.
    // A dropped refresh must not blank the year; a failed *first* load still
    // hydrates, so the sidebar shows the error and a Connect button rather than
    // an indefinite spinner.
    case "LOAD_FAILED":
      return {
        ...state,
        loading: false,
        hasHydratedData: true,
        isRefreshing: false,
        error: action.message,
      };

    case "ERROR_DISMISSED":
      return state.error === null ? state : { ...state, error: null };

    case "CALENDAR_SELECTION_CHANGED":
      return { ...state, selectedCalendarIds: action.selectedCalendarIds };

    case "EVENT_CREATED":
      return { ...state, events: [...state.events, action.event] };

    case "EVENT_UPDATED":
      return {
        ...state,
        events: state.events.map((event) =>
          event.id === action.id ? { ...event, ...action.changes } : event,
        ),
      };

    case "EVENT_DELETED":
      return { ...state, events: state.events.filter((event) => event.id !== action.id) };

    // Compared before storing: the scroll listener fires on every frame and a
    // fresh object would re-render the grid each time.
    case "SCROLL_EDGES_CHANGED":
      return state.scrollEdges.left === action.edges.left &&
        state.scrollEdges.right === action.edges.right
        ? state
        : { ...state, scrollEdges: action.edges };

    case "SIDEBAR_COLLAPSED_CHANGED":
      return state.sidebarCollapsed === action.collapsed
        ? state
        : { ...state, sidebarCollapsed: action.collapsed };

    case "MOBILE_SIDEBAR_OPEN_CHANGED":
      return state.mobileSidebarOpen === action.open
        ? state
        : { ...state, mobileSidebarOpen: action.open };
  }
}
