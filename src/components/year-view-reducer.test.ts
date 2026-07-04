/**
 * Tests for year-view-reducer
 *
 * Verifies all state transitions are correct and testable.
 */

import { describe, expect, it } from "vitest";
import type { CalendarEvent, CalendarSummary } from "@/domain";
import {
  createDataInitialState,
  createInitialState,
  createUiInitialState,
  yearDataReducer,
  yearUiReducer,
  yearViewReducer,
} from "./year-view-reducer";

describe("year-view-reducer", () => {
  describe("createInitialState", () => {
    it("creates default initial state", () => {
      const state = createInitialState();
      expect(state.year).toBe(new Date().getFullYear());
      expect(state.calendars).toEqual([]);
      expect(state.events).toEqual([]);
      expect(state.loading).toBe(true);
      expect(state.hasHydratedData).toBe(false);
      expect(state.error).toBeNull();
    });

    it("accepts overrides", () => {
      const state = createInitialState({ year: 2025, loading: false });
      expect(state.year).toBe(2025);
      expect(state.loading).toBe(false);
    });
  });

  describe("year navigation (yearDataReducer)", () => {
    it("handles SET_YEAR", () => {
      const state = createDataInitialState({ year: 2024 });
      const result = yearDataReducer(state, { type: "SET_YEAR", payload: 2025 });
      expect(result.year).toBe(2025);
    });

    it("handles INCREMENT_YEAR", () => {
      const state = createDataInitialState({ year: 2024 });
      const result = yearDataReducer(state, { type: "INCREMENT_YEAR" });
      expect(result.year).toBe(2025);
    });

    it("handles DECREMENT_YEAR", () => {
      const state = createDataInitialState({ year: 2024 });
      const result = yearDataReducer(state, { type: "DECREMENT_YEAR" });
      expect(result.year).toBe(2023);
    });
  });

  describe("calendar management (yearDataReducer)", () => {
    it("handles SET_CALENDARS", () => {
      const state = createDataInitialState();
      const calendars: CalendarSummary[] = [
        {
          id: "cal1",
          summary: "Calendar 1",
          primary: true,
          backgroundColor: "#000",
          foregroundColor: "#fff",
          accessRole: "owner",
        },
      ];
      const result = yearDataReducer(state, { type: "SET_CALENDARS", payload: calendars });
      expect(result.calendars).toEqual(calendars);
    });

    it("handles SET_SELECTED_CALENDAR_IDS", () => {
      const state = createDataInitialState();
      const result = yearDataReducer(state, {
        type: "SET_SELECTED_CALENDAR_IDS",
        payload: ["cal1", "cal2"],
      });
      expect(result.selectedCalendarIds).toEqual(["cal1", "cal2"]);
    });

    it("handles SET_CALENDARS_AND_SELECTION", () => {
      const state = createDataInitialState();
      const calendars: CalendarSummary[] = [
        {
          id: "cal1",
          summary: "Calendar 1",
          primary: true,
          backgroundColor: "#000",
          foregroundColor: "#fff",
          accessRole: "owner",
        },
      ];
      const result = yearDataReducer(state, {
        type: "SET_CALENDARS_AND_SELECTION",
        payload: { calendars, selectedCalendarIds: ["cal1"] },
      });
      expect(result.calendars).toEqual(calendars);
      expect(result.selectedCalendarIds).toEqual(["cal1"]);
    });

    it("handles TOGGLE_CALENDAR - select", () => {
      const state = createDataInitialState({ selectedCalendarIds: ["cal1"] });
      const result = yearDataReducer(state, { type: "TOGGLE_CALENDAR", payload: "cal2" });
      expect(result.selectedCalendarIds).toEqual(["cal1", "cal2"]);
    });

    it("handles TOGGLE_CALENDAR - deselect", () => {
      const state = createDataInitialState({ selectedCalendarIds: ["cal1", "cal2"] });
      const result = yearDataReducer(state, { type: "TOGGLE_CALENDAR", payload: "cal2" });
      expect(result.selectedCalendarIds).toEqual(["cal1"]);
    });
  });

  describe("event management (yearDataReducer)", () => {
    const mockEvent: CalendarEvent = {
      id: "event1",
      title: "Test Event",
      start: "2024-01-01",
      end: "2024-01-02",
      allDay: true,
      isTimed: false,
      calendarId: "cal1",
      calendarColor: "#000",
      calendarSummary: "Calendar 1",
      htmlLink: "https://example.com",
    };

    it("handles SET_EVENTS", () => {
      const state = createDataInitialState();
      const result = yearDataReducer(state, { type: "SET_EVENTS", payload: [mockEvent] });
      expect(result.events).toEqual([mockEvent]);
    });

    it("handles SET_EVENTS_FUNCTIONAL", () => {
      const state = createDataInitialState({ events: [mockEvent] });
      const result = yearDataReducer(state, {
        type: "SET_EVENTS_FUNCTIONAL",
        payload: (prev) => prev.map((e) => ({ ...e, title: "Fn" })),
      });
      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe("Fn");
    });

    it("handles UPSERT_EVENT - insert new", () => {
      const state = createDataInitialState();
      const result = yearDataReducer(state, { type: "UPSERT_EVENT", payload: mockEvent });
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual(mockEvent);
    });

    it("handles UPSERT_EVENT - update existing", () => {
      const state = createDataInitialState({ events: [mockEvent] });
      const updated = { ...mockEvent, title: "Updated" };
      const result = yearDataReducer(state, { type: "UPSERT_EVENT", payload: updated });
      expect(result.events).toHaveLength(1);
      expect(result.events[0].title).toBe("Updated");
    });

    it("handles REMOVE_EVENT", () => {
      const state = createDataInitialState({ events: [mockEvent] });
      const result = yearDataReducer(state, { type: "REMOVE_EVENT", payload: "event1" });
      expect(result.events).toHaveLength(0);
    });
  });

  describe("loading states (yearDataReducer)", () => {
    it("handles START_LOADING", () => {
      const state = createDataInitialState({ loading: false, error: "error" });
      const result = yearDataReducer(state, { type: "START_LOADING" });
      expect(result.loading).toBe(true);
      expect(result.error).toBeNull();
    });

    it("handles STOP_LOADING", () => {
      const state = createDataInitialState({ loading: true });
      const result = yearDataReducer(state, { type: "STOP_LOADING" });
      expect(result.loading).toBe(false);
    });

    it("handles START_REFRESHING", () => {
      const state = createDataInitialState();
      const result = yearDataReducer(state, { type: "START_REFRESHING" });
      expect(result.isRefreshing).toBe(true);
    });

    it("handles STOP_REFRESHING", () => {
      const state = createDataInitialState({ isRefreshing: true });
      const result = yearDataReducer(state, { type: "STOP_REFRESHING" });
      expect(result.isRefreshing).toBe(false);
    });

    it("handles SET_BUSY", () => {
      const state = createDataInitialState();
      const result = yearDataReducer(state, { type: "SET_BUSY", payload: true });
      expect(result.busy).toBe(true);
    });
  });

  describe("error handling (yearDataReducer)", () => {
    it("handles SET_ERROR", () => {
      const state = createDataInitialState({ loading: true });
      const result = yearDataReducer(state, { type: "SET_ERROR", payload: "Error message" });
      expect(result.error).toBe("Error message");
      expect(result.loading).toBe(false);
    });

    it("handles CLEAR_ERROR", () => {
      const state = createDataInitialState({ error: "Error" });
      const result = yearDataReducer(state, { type: "CLEAR_ERROR" });
      expect(result.error).toBeNull();
    });
  });

  describe("UI state (yearUiReducer)", () => {
    it("handles TOGGLE_SIDEBAR", () => {
      const state = createUiInitialState({ sidebarCollapsed: false });
      const result = yearUiReducer(state, { type: "TOGGLE_SIDEBAR" });
      expect(result.sidebarCollapsed).toBe(true);
    });

    it("handles SET_MOBILE_SIDEBAR_OPEN", () => {
      const state = createUiInitialState();
      const result = yearUiReducer(state, { type: "SET_MOBILE_SIDEBAR_OPEN", payload: true });
      expect(result.mobileSidebarOpen).toBe(true);
    });

    it("handles SET_LIVE_MESSAGE", () => {
      const state = createUiInitialState();
      const result = yearUiReducer(state, { type: "SET_LIVE_MESSAGE", payload: "Test message" });
      expect(result.liveMessage).toBe("Test message");
    });

    it("handles CLEAR_LIVE_MESSAGE", () => {
      const state = createUiInitialState({ liveMessage: "Message" });
      const result = yearUiReducer(state, { type: "CLEAR_LIVE_MESSAGE" });
      expect(result.liveMessage).toBe("");
    });

    it("handles SET_EVENT_RANGE_PREVIEW", () => {
      const state = createUiInitialState();
      const result = yearUiReducer(state, {
        type: "SET_EVENT_RANGE_PREVIEW",
        payload: { eventId: "event1", start: "2024-01-01", endExclusive: "2024-01-05" },
      });
      expect(result.eventRangePreviews.event1).toEqual({
        start: "2024-01-01",
        endExclusive: "2024-01-05",
      });
    });

    it("handles CLEAR_EVENT_RANGE_PREVIEW", () => {
      const state = createUiInitialState({
        eventRangePreviews: { event1: { start: "2024-01-01", endExclusive: "2024-01-05" } },
      });
      const result = yearUiReducer(state, {
        type: "CLEAR_EVENT_RANGE_PREVIEW",
        payload: "event1",
      });
      expect(result.eventRangePreviews.event1).toBeUndefined();
    });

    it("handles SET_EVENT_RANGE_PREVIEWS", () => {
      const state = createUiInitialState({
        eventRangePreviews: { stale: { start: "2024-01-01", endExclusive: "2024-01-02" } },
      });
      const next = { event1: { start: "2024-02-01", endExclusive: "2024-02-05" } };
      const result = yearUiReducer(state, { type: "SET_EVENT_RANGE_PREVIEWS", payload: next });
      expect(result.eventRangePreviews).toEqual(next);
      expect(result.eventRangePreviews.stale).toBeUndefined();
    });

    it("handles SET_EVENT_RANGE_PREVIEWS_FUNCTIONAL", () => {
      const state = createUiInitialState({
        eventRangePreviews: { event1: { start: "2024-01-01", endExclusive: "2024-01-05" } },
      });
      const result = yearUiReducer(state, {
        type: "SET_EVENT_RANGE_PREVIEWS_FUNCTIONAL",
        payload: (prev) => ({
          ...prev,
          event2: { start: "2024-03-01", endExclusive: "2024-03-02" },
        }),
      });
      expect(result.eventRangePreviews.event1).toBeDefined();
      expect(result.eventRangePreviews.event2).toEqual({
        start: "2024-03-01",
        endExclusive: "2024-03-02",
      });
    });
  });

  describe("composite actions", () => {
    it("handles LOAD_INITIAL_DATA", () => {
      const state = createInitialState({ loading: true, error: "old error" });
      const calendars: CalendarSummary[] = [
        {
          id: "cal1",
          summary: "Calendar 1",
          primary: true,
          backgroundColor: "#000",
          foregroundColor: "#fff",
          accessRole: "owner",
        },
      ];
      const events: CalendarEvent[] = [
        {
          id: "event1",
          title: "Test",
          start: "2024-01-01",
          end: "2024-01-02",
          allDay: true,
          isTimed: false,
          calendarId: "cal1",
          calendarColor: "#000",
          calendarSummary: "Calendar 1",
          htmlLink: "https://example.com",
        },
      ];
      const result = yearViewReducer(state, {
        type: "LOAD_INITIAL_DATA",
        payload: {
          calendars,
          selectedCalendarIds: ["cal1"],
          events,
        },
      });
      expect(result.calendars).toEqual(calendars);
      expect(result.selectedCalendarIds).toEqual(["cal1"]);
      expect(result.events).toEqual(events);
      expect(result.loading).toBe(false);
      expect(result.hasHydratedData).toBe(true);
      expect(result.error).toBeNull();
    });

    it("handles REFRESH_COMPLETE - success", () => {
      const state = createInitialState({ isRefreshing: true });
      const events: CalendarEvent[] = [
        {
          id: "event1",
          title: "Test",
          start: "2024-01-01",
          end: "2024-01-02",
          allDay: true,
          isTimed: false,
          calendarId: "cal1",
          calendarColor: "#000",
          calendarSummary: "Calendar 1",
          htmlLink: "https://example.com",
        },
      ];
      const result = yearViewReducer(state, {
        type: "REFRESH_COMPLETE",
        payload: { events, error: null },
      });
      expect(result.events).toEqual(events);
      expect(result.isRefreshing).toBe(false);
      expect(result.error).toBeNull();
    });

    it("handles REFRESH_COMPLETE - with error", () => {
      const state = createInitialState({ isRefreshing: true });
      const result = yearViewReducer(state, {
        type: "REFRESH_COMPLETE",
        payload: { events: [], error: "Refresh failed" },
      });
      expect(result.events).toEqual([]);
      expect(result.isRefreshing).toBe(false);
      expect(result.error).toBe("Refresh failed");
    });
  });

  describe("state immutability", () => {
    it("yearDataReducer does not mutate original state", () => {
      const state = createDataInitialState({ year: 2024 });
      const originalYear = state.year;
      yearDataReducer(state, { type: "INCREMENT_YEAR" });
      expect(state.year).toBe(originalYear);
    });

    it("yearUiReducer does not mutate nested objects", () => {
      const state = createUiInitialState({
        eventRangePreviews: { event1: { start: "2024-01-01", endExclusive: "2024-01-05" } },
      });
      const original = state.eventRangePreviews;
      yearUiReducer(state, {
        type: "SET_EVENT_RANGE_PREVIEW",
        payload: { eventId: "event2", start: "2024-02-01", endExclusive: "2024-02-05" },
      });
      expect(state.eventRangePreviews).toBe(original);
    });
  });
});
