import { useLayoutEffect, useRef, type RefObject } from "react";
import { YEAR_GRID_HEADER_HEIGHT } from "@/components/year-view/constants";
import { scrollMonthIntoView } from "@/components/year-view/month-scroll";
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

    scrollMonthIntoView(container, monthHeaderRefs.current[cell.month], cell.month, behavior);

    const rowTop = (cell.day - 1) * rowHeight;
    if (rowTop < container.scrollTop + YEAR_GRID_HEADER_HEIGHT) {
      container.scrollTo({
        top: Math.max(0, rowTop - YEAR_GRID_HEADER_HEIGHT),
        behavior,
      });
    } else if (rowTop + rowHeight > container.scrollTop + container.clientHeight) {
      container.scrollTo({
        top: rowTop + rowHeight - container.clientHeight,
        behavior,
      });
    }
  }, [cell, monthHeaderRefs, rowHeight, scrollRef]);
}
