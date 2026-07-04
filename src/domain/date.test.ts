import { describe, it, expect } from "vitest";
import {
  toDateInputValue,
  parseDateInput,
  isDateOnlyString,
  parseEventBoundary,
  serializeEventBoundary,
  addDays,
  clampDate,
  startOfYear,
  startOfNextYear,
} from "./index";

describe("toDateInputValue", () => {
  it("returns YYYY-MM-DD for a given date", () => {
    expect(toDateInputValue(new Date(2026, 1, 9))).toBe("2026-02-09");
  });

  it("pads month and day with zero", () => {
    expect(toDateInputValue(new Date(2026, 0, 1))).toBe("2026-01-01");
    expect(toDateInputValue(new Date(2026, 8, 5))).toBe("2026-09-05");
  });

  it("handles Dec 31", () => {
    expect(toDateInputValue(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("parseDateInput", () => {
  it("parses valid YYYY-MM-DD string", () => {
    const d = parseDateInput("2026-02-09");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(1);
    expect(d.getDate()).toBe(9);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("parses Jan 1", () => {
    const d = parseDateInput("2026-01-01");
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });

  it("parses Dec 31", () => {
    const d = parseDateInput("2025-12-31");
    expect(d.getMonth()).toBe(11);
    expect(d.getDate()).toBe(31);
  });
});

describe("isDateOnlyString", () => {
  it("returns true for YYYY-MM-DD", () => {
    expect(isDateOnlyString("2026-02-09")).toBe(true);
  });

  it("returns false for ISO datetime strings", () => {
    expect(isDateOnlyString("2026-02-09T00:00:00.000Z")).toBe(false);
  });
});

describe("parseEventBoundary", () => {
  it("parses all-day date-only strings as local midnight", () => {
    const d = parseEventBoundary("2026-01-15", true);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("parses all-day ISO strings into local midnight of UTC day", () => {
    const d = parseEventBoundary("2026-01-15T00:00:00.000Z", true);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
  });

  it("parses timed boundaries as regular datetimes", () => {
    const d = parseEventBoundary("2026-02-09T10:30:00.000Z", false);
    expect(Number.isNaN(d.getTime())).toBe(false);
  });
});

describe("serializeEventBoundary", () => {
  it("serializes all-day boundaries as date-only strings", () => {
    expect(serializeEventBoundary(new Date(2026, 0, 15, 0, 0, 0, 0), true)).toBe("2026-01-15");
  });

  it("serializes timed boundaries as ISO strings", () => {
    const date = new Date("2026-02-09T10:30:00.000Z");
    expect(serializeEventBoundary(date, false)).toBe(date.toISOString());
  });
});

describe("addDays", () => {
  it("adds positive days", () => {
    const d = new Date(2026, 0, 10);
    const result = addDays(d, 5);
    expect(result.getDate()).toBe(15);
    expect(result.getMonth()).toBe(0);
  });

  it("crosses month boundary", () => {
    const d = new Date(2026, 0, 30);
    const result = addDays(d, 5);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(4);
  });

  it("subtracts when n is negative", () => {
    const d = new Date(2026, 1, 9);
    const result = addDays(d, -9);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(31);
  });

  it("does not mutate original date", () => {
    const d = new Date(2026, 0, 1);
    addDays(d, 10);
    expect(d.getDate()).toBe(1);
  });
});

describe("clampDate", () => {
  const min = new Date(2026, 0, 1);
  const max = new Date(2026, 0, 31);

  it("returns min when date is before min", () => {
    const d = new Date(2025, 11, 15);
    expect(clampDate(d, min, max)).toEqual(min);
  });

  it("returns max when date is after max", () => {
    const d = new Date(2026, 1, 5);
    expect(clampDate(d, min, max)).toEqual(max);
  });

  it("returns date when within range", () => {
    const d = new Date(2026, 0, 15);
    const result = clampDate(d, min, max);
    expect(result).toEqual(d);
  });

  it("returns min when date equals min", () => {
    const d = new Date(2026, 0, 1);
    expect(clampDate(d, min, max)).toEqual(d);
  });
});

describe("startOfYear", () => {
  it("returns Jan 1 00:00:00 of given year", () => {
    const d = startOfYear(2026);
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
  });
});

describe("startOfNextYear", () => {
  it("returns Jan 1 of year+1", () => {
    const d = startOfNextYear(2026);
    expect(d.getFullYear()).toBe(2027);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
  });
});
