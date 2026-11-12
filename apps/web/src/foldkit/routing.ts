import { parseMonthParam, parseYearParam, parseYearViewSearch } from "@/lib/year-view-url";
import { clampCell } from "@/components/year-view/year-grid-keyboard";
import { parseDateInput, toDateInputValue } from "@julian/domain";
import type { Model } from "./model";

export const calendarHref = (model: Pick<Model, "page" | "year" | "date" | "mode" | "details">) => {
  const query = new URLSearchParams({
    month: String(Number(model.date.slice(5, 7))),
    day: String(Number(model.date.slice(8, 10))),
  });
  query.set("details", String(model.details));
  if (model.mode === "timeline") query.set("view", "timeline");
  return `${model.page === "demo" ? "/demo" : ""}/${model.year}?${query}`;
};

export const resolveRoute = (href: string, today: string, connected: boolean) => {
  const url = new URL(href, "https://julian.invalid");
  const parts = url.pathname.split("/").filter(Boolean);
  const demo =
    parts[0] === "demo" || url.pathname === "/foldkit.html" || (parts.length === 0 && !connected);
  const offset = parts[0] === "demo" || parts[0] === "year" ? 1 : 0;
  const rawYear = url.pathname === "/foldkit.html" ? undefined : parts[offset];
  const year = rawYear == null ? Number(today.slice(0, 4)) : parseYearParam(rawYear);
  const search = parseYearViewSearch(Object.fromEntries(url.searchParams));
  const mode = search.view === "timeline" ? ("timeline" as const) : ("grid" as const);
  if (url.pathname === "/auth/callback")
    return {
      page: "callback" as const,
      year: Number(today.slice(0, 4)),
      date: today,
      mode,
      details: false,
    };
  const month = parts[offset + 1] == null ? undefined : parseMonthParam(parts[offset + 1]!);
  if (year === null || month === null || parts.length > offset + 2)
    return {
      page: "not-found" as const,
      year: Number(today.slice(0, 4)),
      date: today,
      mode,
      details: false,
    };
  const current = parseDateInput(today);
  const cell = clampCell(
    {
      month:
        (month ?? search.month ?? (year === current.getFullYear() ? current.getMonth() + 1 : 1)) -
        1,
      day:
        search.day ??
        (month
          ? 1
          : year === current.getFullYear() && search.month == null
            ? current.getDate()
            : 1),
    },
    year,
  );
  return {
    page: demo ? ("demo" as const) : connected ? ("calendar" as const) : ("signed-out" as const),
    year,
    date: toDateInputValue(new Date(year, cell.month, cell.day)),
    mode,
    details: search.details === true,
  };
};
