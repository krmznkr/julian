import { useEffect, type RefObject } from "react";
import { YEAR_GRID_HEADER_HEIGHT } from "@/components/year-view/day-hour-ruler";
import { scrollMonthIntoView } from "@/components/year-view/month-scroll";
import type { KeyboardCell } from "@/components/year-view/year-grid-keyboard";

/**
 * Keeps the active cell on screen as it moves under the keyboard: its month
 * centred horizontally, its row clear of the sticky header vertically.
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
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    scrollMonthIntoView(container, monthHeaderRefs.current[cell.month], cell.month);

    const rowTop = (cell.day - 1) * rowHeight;
    if (rowTop < container.scrollTop + YEAR_GRID_HEADER_HEIGHT) {
      container.scrollTo({
        top: Math.max(0, rowTop - YEAR_GRID_HEADER_HEIGHT),
        behavior: "smooth",
      });
    } else if (rowTop + rowHeight > container.scrollTop + container.clientHeight) {
      container.scrollTo({
        top: rowTop + rowHeight - container.clientHeight,
        behavior: "smooth",
      });
    }
  }, [cell, monthHeaderRefs, rowHeight, scrollRef]);
}
