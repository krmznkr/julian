import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "@/i18n/context";

const i18n = () => renderHook(() => useI18n(), { wrapper: I18nProvider }).result.current;
const range = (start: [number, number, number], end: [number, number, number]) =>
  i18n().formatDateRange(new Date(...start), new Date(...end));

describe("formatDateRange", () => {
  afterEach(cleanup);

  it("collapses the parts a range shares", () => {
    expect(range([2026, 2, 4], [2026, 2, 4])).toBe("Mar 4");
    expect(range([2026, 2, 4], [2026, 2, 9])).toBe("Mar 4–9");
    expect(range([2026, 2, 30], [2026, 3, 2])).toBe("Mar 30 – Apr 2");
    expect(range([2026, 11, 30], [2027, 0, 2])).toBe("Dec 30, 2026 – Jan 2, 2027");
  });

  it("formats single dates with Intl options", () => {
    expect(i18n().formatDate(new Date(2026, 9, 15), { weekday: "short" })).toBe("Thu");
  });

  it("fails loudly outside the provider", () => {
    expect(() => renderHook(() => useI18n())).toThrow(/within I18nProvider/);
  });
});
