import { describe, expect, it } from "vitest";
import {
  buildYearViewSearch,
  cellFromYearViewSearch,
  parseMonthParam,
  parseYearParam,
  parseYearViewSearch,
  todayFocus,
} from "@/lib/year-view-url";

describe("year-view-url", () => {
  it("parses month, day, and details from search params", () => {
    expect(parseYearViewSearch({ month: "6", day: "15", details: "1" })).toEqual({
      month: 6,
      day: 15,
      details: true,
    });
  });

  it("builds a 1-indexed month search object", () => {
    expect(
      buildYearViewSearch({
        cell: { month: 5, day: 12 },
        detailsOpen: true,
      }),
    ).toEqual({ month: 6, day: 12, details: true });
  });

  it("maps search params to a keyboard cell", () => {
    expect(cellFromYearViewSearch(2024, { month: 2, day: 29 })).toEqual({
      month: 1,
      day: 29,
    });
    expect(cellFromYearViewSearch(2026, { month: 2, day: 30 })).toEqual({
      month: 1,
      day: 28,
    });
  });

  it.each([
    ["2026", 2026],
    ["1970", 1970],
    ["2100", 2100],
    ["1969", null],
    ["2101", null],
    ["202", null],
    ["year", null],
    ["2026a", null],
  ])("parses the year segment %j as %s", (raw, expected) => {
    expect(parseYearParam(raw)).toBe(expected);
  });

  it.each([
    ["3", 3],
    ["03", 3],
    ["12", 12],
    ["0", null],
    ["13", null],
    ["003", null],
    ["mar", null],
  ])("parses the month segment %j as %s", (raw, expected) => {
    expect(parseMonthParam(raw)).toBe(expected);
  });

  it("focuses today with a 1-indexed month", () => {
    expect(todayFocus(new Date(2026, 2, 10, 12))).toEqual({
      year: 2026,
      search: { month: 3, day: 10 },
    });
  });
});
