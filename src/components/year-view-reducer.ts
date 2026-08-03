import type { CalendarEvent, CalendarSummary } from "@/domain";

// ============================================================================
// Domain State (events, calendars, loading)
// ============================================================================

export type YearDataState = {
  year: number;
  calendars: CalendarSummary[];
  selectedCalendarIds: string[];
  events: CalendarEvent[];
  loading: boolean;
  hasHydratedData: boolean;
  isRefreshing: boolean;
  busy: boolean;
  calendarLoading: boolean;
  error: string | null;
};

export type YearDataAction =
  | { type: "SET_YEAR"; payload: number }
  | { type: "INCREMENT_YEAR" }
  | { type: "DECREMENT_YEAR" }
  | { type: "SET_CALENDARS"; payload: CalendarSummary[] }
  | { type: "SET_SELECTED_CALENDAR_IDS"; payload: string[] }
  | {
      type: "SET_CALENDARS_AND_SELECTION";
      payload: { calendars: CalendarSummary[]; selectedCalendarIds: string[] };
    }
  | { type: "TOGGLE_CALENDAR"; payload: string }
  | { type: "SET_EVENTS"; payload: CalendarEvent[] }
  | { type: "SET_EVENTS_FUNCTIONAL"; payload: (prev: CalendarEvent[]) => CalendarEvent[] }
  | { type: "UPSERT_EVENT"; payload: CalendarEvent }
  | { type: "REMOVE_EVENT"; payload: string }
  | { type: "START_LOADING" }
  | { type: "STOP_LOADING" }
  | { type: "SET_HAS_HYDRATED_DATA"; payload: boolean }
  | { type: "START_REFRESHING" }
  | { type: "STOP_REFRESHING" }
  | { type: "SET_BUSY"; payload: boolean }
  | { type: "START_CALENDAR_LOADING" }
  | { type: "STOP_CALENDAR_LOADING" }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "CLEAR_ERROR" }
  | {
      type: "LOAD_INITIAL_DATA";
      payload: {
        calendars: CalendarSummary[];
        selectedCalendarIds: string[];
        events: CalendarEvent[];
      };
    }
  | { type: "REFRESH_COMPLETE"; payload: { events: CalendarEvent[]; error: string | null } };

export function createDataInitialState(overrides?: Partial<YearDataState>): YearDataState {
  return {
    year: new Date().getFullYear(),
    calendars: [],
    selectedCalendarIds: [],
    events: [],
    loading: true,
    hasHydratedData: false,
    isRefreshing: false,
    busy: false,
    calendarLoading: false,
    error: null,
    ...overrides,
  };
}

export function yearDataReducer(state: YearDataState, action: YearDataAction): YearDataState {
  switch (action.type) {
    case "SET_YEAR":
      return { ...state, year: action.payload };
    case "INCREMENT_YEAR":
      return { ...state, year: state.year + 1 };
    case "DECREMENT_YEAR":
      return { ...state, year: state.year - 1 };
    case "SET_CALENDARS":
      return { ...state, calendars: action.payload };
    case "SET_SELECTED_CALENDAR_IDS":
      return { ...state, selectedCalendarIds: action.payload };
    case "SET_CALENDARS_AND_SELECTION":
      return {
        ...state,
        calendars: action.payload.calendars,
        selectedCalendarIds: action.payload.selectedCalendarIds,
      };
    case "TOGGLE_CALENDAR": {
      const calendarId = action.payload;
      const isSelected = state.selectedCalendarIds.includes(calendarId);
      return {
        ...state,
        selectedCalendarIds: isSelected
          ? state.selectedCalendarIds.filter((id) => id !== calendarId)
          : [...state.selectedCalendarIds, calendarId],
      };
    }
    case "SET_EVENTS":
      return { ...state, events: action.payload };
    case "SET_EVENTS_FUNCTIONAL":
      return { ...state, events: action.payload(state.events) };
    case "UPSERT_EVENT": {
      const newEvent = action.payload;
      const existingIndex = state.events.findIndex((e) => e.id === newEvent.id);
      if (existingIndex >= 0) {
        return {
          ...state,
          events: state.events.map((e, i) => (i === existingIndex ? newEvent : e)),
        };
      }
      return { ...state, events: [...state.events, newEvent] };
    }
    case "REMOVE_EVENT":
      return { ...state, events: state.events.filter((e) => e.id !== action.payload) };
    case "START_LOADING":
      return { ...state, loading: true, error: null };
    case "STOP_LOADING":
      return { ...state, loading: false };
    case "SET_HAS_HYDRATED_DATA":
      return { ...state, hasHydratedData: action.payload };
    case "START_REFRESHING":
      return { ...state, isRefreshing: true };
    case "STOP_REFRESHING":
      return { ...state, isRefreshing: false };
    case "SET_BUSY":
      return { ...state, busy: action.payload };
    case "START_CALENDAR_LOADING":
      return { ...state, calendarLoading: true };
    case "STOP_CALENDAR_LOADING":
      return { ...state, calendarLoading: false };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };
    case "CLEAR_ERROR":
      return { ...state, error: null };
    case "LOAD_INITIAL_DATA":
      return {
        ...state,
        calendars: action.payload.calendars,
        selectedCalendarIds: action.payload.selectedCalendarIds,
        events: action.payload.events,
        loading: false,
        hasHydratedData: true,
        error: null,
      };
    case "REFRESH_COMPLETE":
      return {
        ...state,
        events: action.payload.events,
        isRefreshing: false,
        error: action.payload.error,
      };
    default:
      return state;
  }
}

// ============================================================================
// UI Chrome State (view presentation, not domain data)
// ============================================================================

export type YearUiState = {
  eventRangePreviews: Record<string, { start: string; endExclusive: string }>;
  scrollEdges: { left: boolean; right: boolean };
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  liveMessage: string;
  userMenuOpen: boolean;
};

export type YearUiAction =
  | {
      type: "SET_EVENT_RANGE_PREVIEW";
      payload: { eventId: string; start: string; endExclusive: string };
    }
  | { type: "CLEAR_EVENT_RANGE_PREVIEW"; payload: string }
  | { type: "CLEAR_ALL_EVENT_RANGE_PREVIEWS" }
  | {
      type: "SET_EVENT_RANGE_PREVIEWS";
      payload: Record<string, { start: string; endExclusive: string }>;
    }
  | {
      type: "SET_EVENT_RANGE_PREVIEWS_FUNCTIONAL";
      payload: (
        prev: Record<string, { start: string; endExclusive: string }>,
      ) => Record<string, { start: string; endExclusive: string }>;
    }
  | { type: "SET_SCROLL_EDGES"; payload: { left: boolean; right: boolean } }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "SET_SIDEBAR_COLLAPSED"; payload: boolean }
  | { type: "TOGGLE_MOBILE_SIDEBAR" }
  | { type: "SET_MOBILE_SIDEBAR_OPEN"; payload: boolean }
  | { type: "SET_LIVE_MESSAGE"; payload: string }
  | { type: "CLEAR_LIVE_MESSAGE" }
  | { type: "TOGGLE_USER_MENU" }
  | { type: "SET_USER_MENU_OPEN"; payload: boolean };

export function createUiInitialState(overrides?: Partial<YearUiState>): YearUiState {
  return {
    eventRangePreviews: {},
    scrollEdges: { left: false, right: false },
    sidebarCollapsed: false,
    mobileSidebarOpen: false,
    liveMessage: "",
    userMenuOpen: false,
    ...overrides,
  };
}

export function yearUiReducer(state: YearUiState, action: YearUiAction): YearUiState {
  switch (action.type) {
    case "SET_EVENT_RANGE_PREVIEW":
      return {
        ...state,
        eventRangePreviews: {
          ...state.eventRangePreviews,
          [action.payload.eventId]: {
            start: action.payload.start,
            endExclusive: action.payload.endExclusive,
          },
        },
      };
    case "CLEAR_EVENT_RANGE_PREVIEW": {
      const { [action.payload]: _, ...rest } = state.eventRangePreviews;
      return { ...state, eventRangePreviews: rest };
    }
    case "CLEAR_ALL_EVENT_RANGE_PREVIEWS":
      return { ...state, eventRangePreviews: {} };
    case "SET_EVENT_RANGE_PREVIEWS":
      return { ...state, eventRangePreviews: action.payload };
    case "SET_EVENT_RANGE_PREVIEWS_FUNCTIONAL":
      return { ...state, eventRangePreviews: action.payload(state.eventRangePreviews) };
    case "SET_SCROLL_EDGES":
      if (
        state.scrollEdges.left === action.payload.left &&
        state.scrollEdges.right === action.payload.right
      ) {
        return state;
      }
      return { ...state, scrollEdges: action.payload };
    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case "SET_SIDEBAR_COLLAPSED":
      return { ...state, sidebarCollapsed: action.payload };
    case "TOGGLE_MOBILE_SIDEBAR":
      return { ...state, mobileSidebarOpen: !state.mobileSidebarOpen };
    case "SET_MOBILE_SIDEBAR_OPEN":
      return { ...state, mobileSidebarOpen: action.payload };
    case "SET_LIVE_MESSAGE":
      return { ...state, liveMessage: action.payload };
    case "CLEAR_LIVE_MESSAGE":
      return { ...state, liveMessage: "" };
    case "TOGGLE_USER_MENU":
      return { ...state, userMenuOpen: !state.userMenuOpen };
    case "SET_USER_MENU_OPEN":
      return { ...state, userMenuOpen: action.payload };
    default:
      return state;
  }
}

// ============================================================================
// Combined (backward-compatible)
// ============================================================================

export type YearViewState = YearDataState & YearUiState;
export type YearViewAction = YearDataAction | YearUiAction;

export function createInitialState(overrides?: Partial<YearViewState>): YearViewState {
  return {
    ...createDataInitialState(overrides),
    ...createUiInitialState(overrides),
  };
}

export function yearViewReducer(state: YearViewState, action: YearViewAction): YearViewState {
  const dataResult = yearDataReducer(state, action as YearDataAction);
  const uiResult = yearUiReducer(state, action as YearUiAction);
  if (dataResult !== state) return { ...uiResult, ...dataResult };
  if (uiResult !== state) return { ...dataResult, ...uiResult };
  return state;
}
