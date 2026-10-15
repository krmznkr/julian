import { describe, expect, it } from "vitest";
import { getDefaultWritableCalendar, isWritableCalendar, TASKS_CALENDAR_ID } from "./index";
import type { CalendarSummary } from "./index";

function calendar(overrides: Partial<CalendarSummary> & { id: string }): CalendarSummary {
  return { summary: overrides.id, ...overrides } as CalendarSummary;
}

describe("isWritableCalendar", () => {
  it("allows owners, writers, and calendars without a role", () => {
    expect(isWritableCalendar(calendar({ id: "a", accessRole: "owner" }))).toBe(true);
    expect(isWritableCalendar(calendar({ id: "b", accessRole: "writer" }))).toBe(true);
    expect(isWritableCalendar(calendar({ id: "c" }))).toBe(true);
    expect(isWritableCalendar(calendar({ id: "d", accessRole: null }))).toBe(true);
  });

  it("rejects readers, the tasks calendar, and missing calendars", () => {
    expect(isWritableCalendar(calendar({ id: "a", accessRole: "reader" }))).toBe(false);
    expect(isWritableCalendar(calendar({ id: TASKS_CALENDAR_ID }))).toBe(false);
    expect(isWritableCalendar(undefined)).toBe(false);
    expect(isWritableCalendar(null)).toBe(false);
  });
});

describe("getDefaultWritableCalendar", () => {
  it("prefers a writable primary calendar", () => {
    const primary = calendar({ id: "primary", primary: true, accessRole: "owner" });
    expect(getDefaultWritableCalendar([calendar({ id: "other" }), primary])).toBe(primary);
  });

  it("falls back to the first writable calendar when the primary is read-only", () => {
    const writable = calendar({ id: "team", accessRole: "writer" });
    expect(
      getDefaultWritableCalendar([
        calendar({ id: "primary", primary: true, accessRole: "reader" }),
        calendar({ id: TASKS_CALENDAR_ID }),
        writable,
      ]),
    ).toBe(writable);
  });

  it("returns null when nothing is writable", () => {
    expect(getDefaultWritableCalendar([calendar({ id: "x", accessRole: "reader" })])).toBeNull();
    expect(getDefaultWritableCalendar([])).toBeNull();
  });
});
