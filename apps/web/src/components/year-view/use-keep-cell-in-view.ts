import { useLayoutEffect, useRef, type RefObject } from "react";
import { YEAR_GRID_HEADER_HEIGHT } from "@/components/year-view/constants";
import { monthScrollLeft } from "@/components/year-view/month-scroll";
import type { KeyboardCell } from "@/components/year-view/year-grid-keyboard";

/**
 * The vertical scroll position that shows a row in full, or the current one
 * when it already is. All values are in the scroll container's content
 * coordinates. `stickyTop` is the height of the sticky header that covers the
 * top of the viewport, so a row is only in view below it.
 */
export function rowScrollTop({
  rowTop,
  rowHeight,
  scrollTop,
  viewportHeight,
  stickyTop,
}: {
  rowTop: number;
  rowHeight: number;
  scrollTop: number;
  viewportHeight: number;
  stickyTop: number;
}): number {
  if (rowTop < scrollTop + stickyTop) return Math.max(0, rowTop - stickyTop);
  if (rowTop + rowHeight > scrollTop + viewportHeight) return rowTop + rowHeight - viewportHeight;
  return scrollTop;
}

/**
 * Where the grid's rows start and how much of the viewport the sticky header
 * covers, measured from the DOM so padding and header changes in CSS are
 * picked up. Every month column starts at the same height, so any mounted one
 * will do. Falls back to the header constant when nothing is laid out (jsdom).
 */
function measureRowGeometry(container: HTMLElement): { firstRowTop: number; stickyTop: number } {
  const header = container.querySelector<HTMLElement>("[data-year-grid-header]");
  const column = container.querySelector<HTMLElement>("[data-month-column]");
  const stickyTop = header?.offsetHeight || YEAR_GRID_HEADER_HEIGHT;
  const firstRowTop = column
    ? column.getBoundingClientRect().top -
      container.getBoundingClientRect().top -
      container.clientTop +
      container.scrollTop
    : stickyTop;
  return { firstRowTop, stickyTop };
}

/**
 * Keeps the active cell on screen as it moves under the keyboard: its month
 * centred horizontally, its row fully visible below the sticky header.
 *
 * The first placement jumps before paint instead of animating: a smooth sweep
 * from January on load is noise, and a scroll before the first contentful
 * paint stops the browser from ever reporting Largest Contentful Paint.
 */
export function useKeepCellInView({
  cell,
  scrollRef,
  monthHeaderRefs,
  rowHeight,
}: {
  cell: KeyboardCell;
  scrollRef: RefObject<HTMLDivElement | null>;
  monthHeaderRefs: RefObject<Array<HTMLDivElement | null>>;
  rowHeight: number;
}) {
  const placedRef = useRef(false);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const behavior: ScrollBehavior = placedRef.current ? "smooth" : "instant";
    placedRef.current = true;

    // One call for both axes: a second smooth scroll would cancel the first
    // mid-animation, leaving the month where it was.
    const { firstRowTop, stickyTop } = measureRowGeometry(container);
    const top = rowScrollTop({
      rowTop: firstRowTop + (cell.day - 1) * rowHeight,
      rowHeight,
      scrollTop: container.scrollTop,
      viewportHeight: container.clientHeight,
      stickyTop,
    });

    container.scrollTo({
      left: monthScrollLeft(container, monthHeaderRefs.current, cell.month),
      top,
      behavior,
    });
  }, [cell, monthHeaderRefs, rowHeight, scrollRef]);
}
