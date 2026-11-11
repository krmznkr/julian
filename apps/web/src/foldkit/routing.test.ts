import { describe, expect, it } from "vitest";
import { calendarHref, resolveRoute } from "./routing";

describe("Foldkit routes", () => {
  it.each([
    ["/", false, "demo", 2026, "2026-03-10"],
    ["/", true, "calendar", 2026, "2026-03-10"],
    ["/demo", false, "demo", 2026, "2026-03-10"],
    ["/demo/2028/02?day=31", false, "demo", 2028, "2028-02-29"],
    ["/2026/07", false, "signed-out", 2026, "2026-07-01"],
    ["/year/2026?month=5&day=2", true, "calendar", 2026, "2026-05-02"],
    ["/2025", true, "calendar", 2025, "2025-01-01"],
    ["/1900", false, "not-found", 2026, "2026-03-10"],
    ["/demo/2026/99", false, "not-found", 2026, "2026-03-10"],
    ["/demo/2026/03/extra", false, "not-found", 2026, "2026-03-10"],
    ["/auth/callback?code=example", false, "callback", 2026, "2026-03-10"],
  ] as const)("resolves %s", (href, connected, page, year, date) => {
    expect(resolveRoute(href, "2026-03-10", connected)).toMatchObject({ page, year, date });
  });
  it("round-trips focus, details and layout", () => {
    const href = calendarHref({
      page: "demo",
      year: 2026,
      date: "2026-10-27",
      details: true,
      mode: "timeline",
    });
    expect(resolveRoute(href, "2026-03-10", false)).toMatchObject({
      page: "demo",
      date: "2026-10-27",
      details: true,
      mode: "timeline",
    });
    expect(
      calendarHref({
        page: "calendar",
        year: 2026,
        date: "2026-01-02",
        details: false,
        mode: "grid",
      }),
    ).toBe("/2026?month=1&day=2&details=false");
  });
});
