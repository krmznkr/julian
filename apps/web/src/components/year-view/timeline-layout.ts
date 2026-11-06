// Pure helpers for the timeline view: sizing, the visible-range label and
// keyboard movement between bars. Date maths lives in @julian/domain.
import {
  dateFromDayIndex,
  dayIndexInYear,
  daysInYear,
  timelineWindowStart,
  timelineZoomDays,
  type TimelineRow,
  type TimelineZoom,
} from "@julian/domain";

export const TIMELINE_LANE_HEIGHT = 28;
export const TIMELINE_ROW_PADDING = 8;
/** Before the first measurement (and in jsdom), assume a laptop-width viewport. */
export const TIMELINE_FALLBACK_WIDTH = 1024;
/** Narrower than this and the year zoom scrolls rather than squashing days to slivers. */
const MIN_DAY_WIDTH = 2;

export const TIMELINE_ZOOM_LABELS: Readonly<Record<TimelineZoom, string>> = {
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

/** Width of the sticky calendar-name column. */
export function timelineLabelWidth(viewportWidth: number): number {
  return viewportWidth < 640 ? 96 : 176;
}

/** Pixels per day so that the zoom's window fills the track. */
export function timelineDayWidth(viewportWidth: number, zoom: TimelineZoom, year: number): number {
  const track = Math.max(0, viewportWidth - timelineLabelWidth(viewportWidth));
  return Math.max(MIN_DAY_WIDTH, track / timelineZoomDays(zoom, year));
}

/** The zoom one step in (`-1`) or out (`1`), clamped to the ends of the list. */
export function stepZoom(
  zooms: ReadonlyArray<TimelineZoom>,
  zoom: TimelineZoom,
  direction: -1 | 1,
): TimelineZoom {
  const index = zooms.indexOf(zoom);
  return zooms[Math.min(zooms.length - 1, Math.max(0, index + direction))] ?? zoom;
}

/** Rough rendered width of a bar title at 12px, capped like the CSS cap on outside labels. */
export function timelineLabelPx(title: string): number {
  return Math.min(180, Math.ceil(title.length * 6.5) + 12);
}

/** Below this a bar is too narrow for its title to be worth truncating inside it. */
const MIN_INSIDE_TITLE_PX = 56;

export type TimelineLabelMode = "inside" | "outside" | "none";

/**
 * Where a bar's title goes: inside when the bar is wide enough, beside it when
 * not (lanes reserve the room), and nowhere at the year zoom, where beside-bar
 * labels would multiply the lanes.
 */
export function timelineLabelMode(
  barPx: number,
  title: string,
  zoom: TimelineZoom,
): TimelineLabelMode {
  if (barPx >= Math.min(timelineLabelPx(title), MIN_INSIDE_TITLE_PX)) return "inside";
  return zoom === "year" ? "none" : "outside";
}

/** Days a bar blocks in its lane, counting a beside-bar title. */
export function timelineReserveDays(
  title: string,
  spanDays: number,
  dayWidth: number,
  zoom: TimelineZoom,
): number {
  if (timelineLabelMode(spanDays * dayWidth, title, zoom) !== "outside") return 0;
  return spanDays + Math.ceil((timelineLabelPx(title) + 6) / dayWidth);
}

export function clampDayIndex(index: number, year: number): number {
  return Math.min(daysInYear(year) - 1, Math.max(0, index));
}

/** Day index where the zoom's window containing `date` starts, kept inside `year`. */
export function windowStartIndex(zoom: TimelineZoom, date: Date, year: number): number {
  return clampDayIndex(dayIndexInYear(timelineWindowStart(zoom, date), year), year);
}

const SHORT_MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });
const LONG_MONTH = new Intl.DateTimeFormat("en-US", { month: "long" });

function isLastDayOfMonth(date: Date): boolean {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getDate() === 1;
}

/**
 * "November 2026", "Oct – Dec 2026", "Nov 2 – 8, 2026" or "Nov 30 – Dec 6, 2026"
 * for the days between two indexes (inclusive).
 */
export function formatTimelineRange(year: number, firstIndex: number, lastIndex: number): string {
  const first = dateFromDayIndex(year, clampDayIndex(firstIndex, year));
  const last = dateFromDayIndex(year, clampDayIndex(lastIndex, year));
  const short = (date: Date) => SHORT_MONTH.format(date);
  const sameMonth = first.getMonth() === last.getMonth();

  if (first.getDate() === 1 && isLastDayOfMonth(last)) {
    if (first.getMonth() === 0 && last.getMonth() === 11) return String(year);
    return sameMonth
      ? `${LONG_MONTH.format(first)} ${year}`
      : `${short(first)} – ${short(last)} ${year}`;
  }
  return sameMonth
    ? `${short(first)} ${first.getDate()} – ${last.getDate()}, ${year}`
    : `${short(first)} ${first.getDate()} – ${short(last)} ${last.getDate()}, ${year}`;
}

export type TimelineMove = "left" | "right" | "up" | "down" | "home" | "end";

/**
 * The bar keyboard focus moves to. Left and right walk a calendar's bars in
 * date order; up and down jump to the nearest-starting bar in the next
 * calendar that has any. Returns null at an edge.
 */
export function adjacentTimelineBar(
  rows: ReadonlyArray<TimelineRow>,
  currentKey: string,
  move: TimelineMove,
): string | null {
  const rowIndex = rows.findIndex((row) => row.bars.some((bar) => bar.key === currentKey));
  const row = rows[rowIndex];
  if (!row) return null;
  const barIndex = row.bars.findIndex((bar) => bar.key === currentKey);
  const current = row.bars[barIndex];
  if (!current) return null;

  switch (move) {
    case "left":
      return row.bars[barIndex - 1]?.key ?? null;
    case "right":
      return row.bars[barIndex + 1]?.key ?? null;
    case "home":
      return row.bars[0]?.key ?? null;
    case "end":
      return row.bars.at(-1)?.key ?? null;
    case "up":
    case "down": {
      const candidates =
        move === "up" ? rows.slice(0, rowIndex).reverse() : rows.slice(rowIndex + 1);
      const target = candidates.find((candidate) => candidate.bars.length > 0);
      if (!target) return null;
      const nearest = target.bars.reduce((best, bar) =>
        Math.abs(bar.startIndex - current.startIndex) <
        Math.abs(best.startIndex - current.startIndex)
          ? bar
          : best,
      );
      return nearest.key;
    }
  }
}

/** The first bar that is on screen, or else the first bar at all: the timeline's tab stop. */
export function firstVisibleTimelineBar(
  rows: ReadonlyArray<TimelineRow>,
  visibleStart: number,
): string | null {
  const bars = rows.flatMap((row) => row.bars);
  return (bars.find((bar) => bar.endIndex >= visibleStart) ?? bars[0])?.key ?? null;
}
