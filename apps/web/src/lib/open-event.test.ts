import { afterEach, describe, expect, it, vi } from "vitest";
import { TASKS_CALENDAR_ID, type CalendarEvent } from "@julian/domain";
import { openDayInGoogleCalendar, openEventInGoogle } from "@/lib/open-event";

const event = (overrides: Partial<CalendarEvent>): CalendarEvent => ({
  id: "e1",
  title: "Standup",
  description: null,
  start: "2026-10-15",
  end: "2026-10-16",
  allDay: true,
  isTimed: false,
  calendarId: "primary",
  calendarColor: null,
  calendarSummary: "Work",
  htmlLink: "https://calendar.google.com/event?eid=1",
  ...overrides,
});

describe("open in Google", () => {
  const open = () => vi.spyOn(window, "open").mockReturnValue(null);
  afterEach(() => vi.restoreAllMocks());

  it("opens a calendar event at its own link", async () => {
    const spy = open();
    openEventInGoogle(event({}));
    await vi.waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        "https://calendar.google.com/event?eid=1",
        "_blank",
        "noopener,noreferrer",
      ),
    );
  });

  it("opens a task on its week, since tasks have no deep link", async () => {
    const spy = open();
    openEventInGoogle(event({ calendarId: TASKS_CALENDAR_ID, htmlLink: null }));
    await vi.waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        "https://calendar.google.com/calendar/u/0/r/week/2026/10/15",
        "_blank",
        "noopener,noreferrer",
      ),
    );
  });

  it("does nothing for an event without a link or a task without a date", async () => {
    const spy = open();
    openEventInGoogle(event({ htmlLink: null }));
    openEventInGoogle(event({ calendarId: TASKS_CALENDAR_ID, start: "" }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(spy).not.toHaveBeenCalled();
  });

  it("opens a day with a one-based month", async () => {
    const spy = open();
    openDayInGoogleCalendar(2026, 0, 31);
    await vi.waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        "https://calendar.google.com/calendar/u/0/r/day/2026/1/31",
        "_blank",
        "noopener,noreferrer",
      ),
    );
  });
});
