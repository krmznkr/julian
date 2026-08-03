import { describe, expect, it } from "vitest";
import {
  buildYearViewSearch,
  cellFromYearViewSearch,
  parseYearViewSearch,
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
});
