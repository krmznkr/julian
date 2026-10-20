import { useEffect, type RefObject } from "react";

export const FALLBACK_MONTH_WIDTH = 220;
export const MONTH_GAP_PX = 4;
const FALLBACK_GUTTER_WIDTH = 44;

/**
 * Read a length custom property from the root as pixels.
 *
 * The sizes are registered with `@property` in `globals.css`, so the computed
 * value is a resolved length ("196px") rather than the authored
 * `clamp(...)` or `rem` expression. Falls back when the property is missing or
 * unresolved, which happens in jsdom and before first paint.
 */
function readRootLength(name: string, fallback: number): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!/^-?\d*\.?\d+px$/.test(raw)) return fallback;
  const parsed = Number.parseFloat(raw);
  return parsed > 0 ? parsed : fallback;
}

/**
 * The rendered width of one month column.
 *
 * Layout is driven by the `--month-col-width` custom property so CSS stays the
 * single source of truth for sizing, but the virtualiser and the scroll-to-month
 * maths both need the number in JS.
 */
export function readMonthColumnWidth(): number {
  return readRootLength("--month-col-width", FALLBACK_MONTH_WIDTH);
}

/** The width of the sticky date gutter that covers the grid's left edge. */
function readDayGutterWidth(): number {
  return readRootLength("--day-gutter-width", FALLBACK_GUTTER_WIDTH);
}

/**
 * The scroll position that centres a month in the part of the grid the reader
 * can see: right of the sticky date gutter. When the month is wider than that
 * area, its start is kept just right of the gutter instead.
 *
 * `monthLeft` is the month's left edge in scroll-content coordinates.
 */
export function monthCenterScrollLeft({
  monthLeft,
  monthWidth,
  viewportWidth,
  gutterWidth,
}: {
  monthLeft: number;
  monthWidth: number;
  viewportWidth: number;
  gutterWidth: number;
}): number {
  const margin = Math.max(0, (viewportWidth - gutterWidth - monthWidth) / 2);
  return Math.max(0, monthLeft - gutterWidth - margin);
}

/** An element's left edge in the scroll container's content coordinates. */
function contentLeft(container: HTMLElement, element: HTMLElement): number {
  return (
    element.getBoundingClientRect().left -
    container.getBoundingClientRect().left -
    container.clientLeft +
    container.scrollLeft
  );
}

/**
 * Where a month starts, in content coordinates. Virtualisation means a
 * far-away month may not be mounted; its position is then counted from any
 * month that is, so padding, gutter and gaps are measured rather than assumed.
 */
function monthContentLeft(
  container: HTMLElement,
  monthElements: ReadonlyArray<HTMLElement | null | undefined>,
  monthIndex: number,
  monthWidth: number,
): number {
  const own = monthElements[monthIndex];
  if (own) return contentLeft(container, own);
  const anchorIndex = monthElements.findIndex(Boolean);
  const anchor = monthElements[anchorIndex];
  const span = monthWidth + MONTH_GAP_PX;
  return anchor
    ? contentLeft(container, anchor) + (monthIndex - anchorIndex) * span
    : monthIndex * span;
}

/**
 * The scroll position that centres a month in the visible grid rather than
 * pinning it left, so the months either side stay visible for context.
 */
export function monthScrollLeft(
  container: HTMLElement,
  monthElements: ReadonlyArray<HTMLElement | null | undefined>,
  monthIndex: number,
): number {
  const monthWidth = monthElements[monthIndex]?.offsetWidth || readMonthColumnWidth();
  return monthCenterScrollLeft({
    monthLeft: monthContentLeft(container, monthElements, monthIndex, monthWidth),
    monthWidth,
    viewportWidth: container.clientWidth,
    gutterWidth: readDayGutterWidth(),
  });
}

/** Smoothly scroll a month into the centre of the visible grid. */
export function scrollMonthIntoView(
  container: HTMLElement,
  monthElements: ReadonlyArray<HTMLElement | null | undefined>,
  monthIndex: number,
): void {
  container.scrollTo({
    left: monthScrollLeft(container, monthElements, monthIndex),
    behavior: "smooth",
  });
}

/**
 * Run `onChange` on horizontal scroll and on resize, coalesced to one call per
 * animation frame. Both the virtualiser and the scroll-shadow tracker listen to
 * the same events at the same rate; doing it twice by hand invited drift.
 */
export function useRafViewportListener(
  containerRef: RefObject<HTMLElement | null>,
  onChange: () => void,
  enabled = true,
): void {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    const frame = { id: undefined as number | undefined };

    const schedule = () => {
      if (frame.id !== undefined) return;
      // eslint-disable-next-line functional/immutable-data
      frame.id = window.requestAnimationFrame(() => {
        // eslint-disable-next-line functional/immutable-data
        frame.id = undefined;
        onChange();
      });
    };

    onChange();
    container.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);

    return () => {
      if (frame.id !== undefined) window.cancelAnimationFrame(frame.id);
      container.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
    };
  }, [containerRef, enabled, onChange]);
}
