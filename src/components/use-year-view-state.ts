/**
 * Year View State Hook
 *
 * Wraps the year-view reducer with a convenient hook API that provides
 * both the state and dispatch-based setters. This allows gradual migration
 * from useState to useReducer while maintaining backward compatibility.
 */

import { useCallback, useMemo, useReducer } from "react";
import type { CalendarEvent, CalendarSummary } from "@/domain";
import {
  createDataInitialState,
  createUiInitialState,
  yearDataReducer,
  yearUiReducer,
} from "./year-view-reducer";
import type { YearViewAction } from "./year-view-reducer";

type YearViewInitialData = {
  year: number;
  calendars?: CalendarSummary[];
  selectedCalendarIds?: string[];
  events?: CalendarEvent[];
  loading?: boolean;
  hasHydratedData?: boolean;
};

/**
 * Hook that manages year-view state with a reducer while providing
 * setter functions compatible with the previous useState API.
 */
export function useYearViewState(initialData: YearViewInitialData) {
  const [dataState, dataDispatch] = useReducer(yearDataReducer, undefined, () =>
    createDataInitialState({
      year: initialData.year,
      calendars: initialData.calendars ?? [],
      selectedCalendarIds: initialData.selectedCalendarIds ?? [],
      events: initialData.events ?? [],
      loading: initialData.loading ?? initialData.calendars == null,
      hasHydratedData: initialData.hasHydratedData ?? initialData.calendars != null,
    }),
  );
  const [uiState, uiDispatch] = useReducer(yearUiReducer, undefined, createUiInitialState);

  const dispatch = useCallback(
    (action: YearViewAction) => {
      dataDispatch(action as Parameters<typeof dataDispatch>[0]);
      uiDispatch(action as Parameters<typeof uiDispatch>[0]);
    },
    [dataDispatch, uiDispatch],
  );

  const state = useMemo(() => ({ ...dataState, ...uiState }), [dataState, uiState]);

  // Provide setter functions that dispatch actions (backward compatible API)
  const setYear = useCallback(
    (year: number | ((prev: number) => number)) => {
      if (typeof year === "function") {
        // For functional updates, we need to get current state first
        dispatch({ type: "SET_YEAR", payload: year(state.year) });
      } else {
        dispatch({ type: "SET_YEAR", payload: year });
      }
    },
    [dispatch, state.year],
  );

  const setCalendars = useCallback(
    (calendars: CalendarSummary[]) => {
      dispatch({ type: "SET_CALENDARS", payload: calendars });
    },
    [dispatch],
  );

  const setSelectedCalendarIds = useCallback(
    (ids: string[]) => {
      dispatch({ type: "SET_SELECTED_CALENDAR_IDS", payload: ids });
    },
    [dispatch],
  );

  const setEvents = useCallback(
    (events: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) => {
      if (typeof events === "function") {
        dispatch({ type: "SET_EVENTS_FUNCTIONAL", payload: events });
      } else {
        dispatch({ type: "SET_EVENTS", payload: events });
      }
    },
    [dispatch],
  );

  const setLoading = useCallback(
    (loading: boolean) => {
      if (loading) {
        dispatch({ type: "START_LOADING" });
      } else {
        dispatch({ type: "STOP_LOADING" });
      }
    },
    [dispatch],
  );

  const setHasHydratedData = useCallback(
    (hasHydrated: boolean) => {
      dispatch({ type: "SET_HAS_HYDRATED_DATA", payload: hasHydrated });
    },
    [dispatch],
  );

  const setIsRefreshing = useCallback(
    (refreshing: boolean) => {
      if (refreshing) {
        dispatch({ type: "START_REFRESHING" });
      } else {
        dispatch({ type: "STOP_REFRESHING" });
      }
    },
    [dispatch],
  );

  const setError = useCallback(
    (error: string | null) => {
      if (error === null) {
        dispatch({ type: "CLEAR_ERROR" });
      } else {
        dispatch({ type: "SET_ERROR", payload: error });
      }
    },
    [dispatch],
  );

  const setBusy = useCallback(
    (busy: boolean) => {
      dispatch({ type: "SET_BUSY", payload: busy });
    },
    [dispatch],
  );

  const setCalendarLoading = useCallback(
    (loading: boolean) => {
      if (loading) {
        dispatch({ type: "START_CALENDAR_LOADING" });
      } else {
        dispatch({ type: "STOP_CALENDAR_LOADING" });
      }
    },
    [dispatch],
  );

  const setEventRangePreviews = useCallback(
    (
      previews:
        | Record<string, { start: string; endExclusive: string }>
        | ((
            prev: Record<string, { start: string; endExclusive: string }>,
          ) => Record<string, { start: string; endExclusive: string }>),
    ) => {
      if (typeof previews === "function") {
        dispatch({ type: "SET_EVENT_RANGE_PREVIEWS_FUNCTIONAL", payload: previews });
      } else {
        dispatch({ type: "SET_EVENT_RANGE_PREVIEWS", payload: previews });
      }
    },
    [dispatch],
  );

  const setScrollEdges = useCallback(
    (edges: { left: boolean; right: boolean }) => {
      dispatch({ type: "SET_SCROLL_EDGES", payload: edges });
    },
    [dispatch],
  );

  const setSidebarCollapsed = useCallback(
    (collapsed: boolean | ((prev: boolean) => boolean)) => {
      if (typeof collapsed === "function") {
        const newCollapsed = collapsed(state.sidebarCollapsed);
        dispatch({ type: "SET_SIDEBAR_COLLAPSED", payload: newCollapsed });
      } else {
        dispatch({ type: "SET_SIDEBAR_COLLAPSED", payload: collapsed });
      }
    },
    [dispatch, state.sidebarCollapsed],
  );

  const setMobileSidebarOpen = useCallback(
    (open: boolean) => {
      dispatch({ type: "SET_MOBILE_SIDEBAR_OPEN", payload: open });
    },
    [dispatch],
  );

  const setLiveMessage = useCallback(
    (message: string) => {
      if (message === "") {
        dispatch({ type: "CLEAR_LIVE_MESSAGE" });
      } else {
        dispatch({ type: "SET_LIVE_MESSAGE", payload: message });
      }
    },
    [dispatch],
  );

  const setUserMenuOpen = useCallback(
    (open: boolean) => {
      dispatch({ type: "SET_USER_MENU_OPEN", payload: open });
    },
    [dispatch],
  );

  return {
    state,
    dispatch,
    // Expose individual state values
    ...state,
    // Expose setter functions
    setYear,
    setCalendars,
    setSelectedCalendarIds,
    setEvents,
    setLoading,
    setHasHydratedData,
    setIsRefreshing,
    setError,
    setBusy,
    setCalendarLoading,
    setEventRangePreviews,
    setScrollEdges,
    setSidebarCollapsed,
    setMobileSidebarOpen,
    setLiveMessage,
    setUserMenuOpen,
  };
}
