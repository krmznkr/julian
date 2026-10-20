import { useLayoutEffect, useRef, type RefObject } from "react";
import { YEAR_GRID_HEADER_HEIGHT } from "@/components/year-view/constants";
import { monthScrollLeft } from "@/components/year-view/month-scroll";
import type { KeyboardCell } from "@/components/year-view/year-grid-keyboard";

/**
 * Keeps the active cell on screen as it moves under the keyboard: its month
 * centred horizontally, its row clear of the sticky header vertically.
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
    const rowTop = (cell.day - 1) * rowHeight;
    const top =
      rowTop < container.scrollTop + YEAR_GRID_HEADER_HEIGHT
        ? Math.max(0, rowTop - YEAR_GRID_HEADER_HEIGHT)
        : rowTop + rowHeight > container.scrollTop + container.clientHeight
          ? rowTop + rowHeight - container.clientHeight
          : container.scrollTop;

    container.scrollTo({
      left: monthScrollLeft(container, monthHeaderRefs.current, cell.month),
      top,
      behavior,
    });
  }, [cell, monthHeaderRefs, rowHeight, scrollRef]);
}
