import { clampCell, type KeyboardCell } from "@/components/year-view/year-grid-keyboard";

export type YearViewSearch = {
  month?: number;
  day?: number;
  details?: boolean;
};

export function parseYearViewSearch(raw: Record<string, unknown>): YearViewSearch {
  const month = parseSearchInt(raw.month);
  const day = parseSearchInt(raw.day);
  const details = raw.details;

  return {
    month: month != null && month >= 1 && month <= 12 ? month : undefined,
    day: day != null && day >= 1 && day <= 31 ? day : undefined,
    details: details === true || details === 1 || details === "1" || details === "true",
  };
}

function parseSearchInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function cellFromYearViewSearch(year: number, search: YearViewSearch): KeyboardCell | null {
  if (search.month == null && search.day == null) return null;
  const month = search.month != null ? search.month - 1 : 0;
  const day = search.day ?? 1;
  return clampCell({ month, day }, year);
}

export function buildYearViewSearch(focus: {
  cell: KeyboardCell;
  detailsOpen: boolean;
}): YearViewSearch {
  return {
    month: focus.cell.month + 1,
    day: focus.cell.day,
    ...(focus.detailsOpen ? { details: true } : {}),
  };
}

export function yearViewSearchSignature(search: YearViewSearch) {
  return `${search.month ?? ""}:${search.day ?? ""}:${search.details ? 1 : 0}`;
}

export function focusSignature(focus: { cell: KeyboardCell; detailsOpen: boolean }) {
  return `${focus.cell.month}:${focus.cell.day}:${focus.detailsOpen ? 1 : 0}`;
}
