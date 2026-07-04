import { describe, expect, it } from "vitest";

import { isTimedMultiDayEvent, normalizeEvent } from "./index";
import type { CalendarSummary } from "./index";

const calendar: CalendarSummary = {
  id: "cal_1",
  summary: "Work",
  primary: false,
  accessRole: "owner",
  backgroundColor: "#123456",
  foregroundColor: null,
};

describe("isTimedMultiDayEvent", () => {
  it("returns false when start and end are on the same day", () => {
    const start = new Date("2026-02-01T09:00:00.000Z");
    const end = new Date("2026-02-01T20:00:00.000Z");

    expect(isTimedMultiDayEvent(start, end)).toBe(false);
  });

  it("returns true when end day is after start day", () => {
    const start = new Date("2026-02-01T10:00:00.000Z");
    const end = new Date("2026-02-03T01:00:00.000Z");

    expect(isTimedMultiDayEvent(start, end)).toBe(true);
  });
});

describe("normalizeEvent", () => {
  it("returns null when start or end are missing", () => {
    expect(normalizeEvent({ id: "1" }, calendar)).toBeNull();
    expect(
      normalizeEvent(
        {
          id: "2",
          start: { dateTime: "2026-02-01T09:00:00.000Z" },
        },
        calendar,
      ),
    ).toBeNull();
  });

  it("returns null when parsed dates are invalid", () => {
    expect(
      normalizeEvent(
        {
          id: "3",
          start: { dateTime: "bad-date" },
          end: { dateTime: "2026-02-02T09:00:00.000Z" },
        },
        calendar,
      ),
    ).toBeNull();
  });

  it("returns null when duration is zero or negative", () => {
    expect(
      normalizeEvent(
        {
          id: "4",
          start: { dateTime: "2026-02-01T09:00:00.000Z" },
          end: { dateTime: "2026-02-01T09:00:00.000Z" },
        },
        calendar,
      ),
    ).toBeNull();
  });

  it("returns null for timed single-day events", () => {
    expect(
      normalizeEvent(
        {
          id: "5",
          summary: "Same-day timed",
          start: { dateTime: "2026-02-01T09:00:00.000Z" },
          end: { dateTime: "2026-02-01T10:00:00.000Z" },
        },
        calendar,
      ),
    ).toBeNull();
  });

  it("normalizes all-day events", () => {
    const event = normalizeEvent(
      {
        id: "6",
        summary: "All-day",
        start: { date: "2026-02-10" },
        end: { date: "2026-02-12" },
        htmlLink: "https://calendar.google.com/event?all-day",
      },
      calendar,
    );

    expect(event).not.toBeNull();
    expect(event?.allDay).toBe(true);
    expect(event?.isTimed).toBe(false);
    expect(event?.calendarColor).toBe("#123456");
    expect(event?.start).toBe("2026-02-10");
    expect(event?.end).toBe("2026-02-12");
  });

  it("normalizes timed multi-day events and applies fallbacks", () => {
    const event = normalizeEvent(
      {
        start: { dateTime: "2026-02-11T10:00:00.000Z" },
        end: { dateTime: "2026-02-12T12:00:00.000Z" },
      },
      {
        ...calendar,
        summary: "",
        backgroundColor: null,
      },
    );

    expect(event).not.toBeNull();
    expect(event?.allDay).toBe(false);
    expect(event?.isTimed).toBe(true);
    expect(event?.title).toBe("Untitled");
    expect(event?.calendarSummary).toBe("");
    expect(event?.calendarColor).toBeNull();
    expect(event?.start).toBe("2026-02-11T10:00:00.000Z");
    expect(event?.end).toBe("2026-02-12T12:00:00.000Z");
    expect(event?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
