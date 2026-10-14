import { useCallback, useEffect, type RefObject } from "react";
import { scrollMonthIntoView, useRafViewportListener } from "@/components/year-view/month-scroll";
import type { YearViewSearch } from "@/lib/year-view-url";

/** How far from an edge we still consider the grid "scrolled", in px. */
const EDGE_TOLERANCE_PX = 4;
/** How long a `?day=` deep link stays highlighted before fading out. */
const JUMP_HIGHLIGHT_MS = 3500;

/**
 * The scrolling half of the year view: where the viewport is, where it should
 * go, and what it should highlight when arriving from a deep link.
 */
export function useYearViewViewport({
  scrollRef,
  monthHeaderRefs,
  onScrollEdgesChange,
  search,
  year,
  setJumpDayHighlight,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  monthHeaderRefs: RefObject<Array<HTMLDivElement | null>>;
  onScrollEdgesChange: (edges: { left: boolean; right: boolean }) => void;
  search: YearViewSearch;
  /** Re-scrolls when the year changes so a deep link keeps its month centred. */
  year: number;
  setJumpDayHighlight: (value: number | null) => void;
}) {
  const scrollToMonth = useCallback(
    (targetMonth: number) => {
      const container = scrollRef.current;
      if (!container) return;
      scrollMonthIntoView(container, monthHeaderRefs.current[targetMonth], targetMonth);
    },
    [monthHeaderRefs, scrollRef],
  );

  // Drives the fade-out shadows on either side of the grid.
  const updateEdges = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    onScrollEdgesChange({
      left: container.scrollLeft > EDGE_TOLERANCE_PX,
      right:
        container.scrollLeft + container.clientWidth < container.scrollWidth - EDGE_TOLERANCE_PX,
    });
  }, [onScrollEdgesChange, scrollRef]);

  useRafViewportListener(scrollRef, updateEdges);

  // A trackpad swipe left at scrollLeft 0 would trigger the browser's
  // back-navigation gesture, silently leaving the app mid-scroll.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      const isLeftIntent = event.deltaX < 0 || (event.shiftKey && event.deltaY < 0);
      if (!isLeftIntent || container.scrollLeft > 0) return;
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) event.preventDefault();
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => container.removeEventListener("wheel", handleWheel);
  }, [scrollRef]);

  // Deep links: `?month=` scrolls, `?day=` briefly highlights the row.
  const { month, day } = search;

  useEffect(() => {
    if (month == null || month < 1 || month > 12) return;
    scrollToMonth(month - 1);
  }, [month, scrollToMonth, year]);

  useEffect(() => {
    if (day == null || day < 1 || day > 31) return;
    setJumpDayHighlight(day);
    const timer = window.setTimeout(() => setJumpDayHighlight(null), JUMP_HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [day, setJumpDayHighlight]);

  return { scrollToMonth };
}
