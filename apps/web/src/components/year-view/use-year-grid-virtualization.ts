import { type RefObject, useCallback, useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import {
  MONTH_GAP_PX,
  FALLBACK_MONTH_WIDTH,
  readMonthColumnWidth,
  useRafViewportListener,
} from "@/components/year-view/month-scroll";
import type { MonthSegments } from "@julian/domain";

/** Columns rendered beyond the viewport on each side, to hide scroll latency. */
const OVERSCAN_COLUMNS = 2;

/**
 * Renders only the month columns near the viewport, with spacers standing in for
 * the rest so the scrollbar keeps its true length.
 */
export function useYearGridVirtualization({
  months,
  scrollRef,
}: {
  months: MonthSegments[];
  scrollRef: RefObject<HTMLDivElement | null>;
}) {
  const [monthWidth, setMonthWidth] = useState(FALLBACK_MONTH_WIDTH);
  const [visibleRange, setVisibleRange] = useState({
    start: 0,
    end: Math.max(0, months.length - 1),
  });

  const updateVisibleRange = useCallback(() => {
    const container = scrollRef.current;
    if (!container || months.length === 0) return;

    const width = readMonthColumnWidth();
    const columnSpan = Math.max(width + MONTH_GAP_PX, 1);
    const nextRange = {
      start: Math.max(0, Math.floor(container.scrollLeft / columnSpan) - OVERSCAN_COLUMNS),
      end: Math.min(
        months.length - 1,
        Math.ceil((container.scrollLeft + container.clientWidth) / columnSpan) + OVERSCAN_COLUMNS,
      ),
    };

    setMonthWidth((current) => (current === width ? current : width));
    setVisibleRange((current) =>
      current.start === nextRange.start && current.end === nextRange.end ? current : nextRange,
    );
  }, [months.length, scrollRef]);

  useRafViewportListener(scrollRef, updateVisibleRange, months.length > 0);

  const printing = usePrinting();
  const range = printing ? { start: 0, end: Math.max(0, months.length - 1) } : visibleRange;

  const visibleMonths = useMemo(
    () => months.slice(range.start, range.end + 1),
    [months, range.start, range.end],
  );

  const leftCount = range.start;
  const rightCount = Math.max(0, months.length - range.end - 1);
  const spacerWidth = (count: number) =>
    count <= 0 ? 0 : count * monthWidth + Math.max(0, count - 1) * MONTH_GAP_PX;

  return {
    leftCount,
    leftSpacerStyle: { width: `${spacerWidth(leftCount)}px` },
    monthWidth,
    rightCount,
    rightSpacerStyle: { width: `${spacerWidth(rightCount)}px` },
    visibleMonths,
  };
}

/** True while the page is being printed, when every month must be in the DOM. */
function usePrinting() {
  const [printing, setPrinting] = useState(false);
  useEffect(() => {
    // Chrome lays out the print right after this event, so render synchronously.
    const start = () => flushSync(() => setPrinting(true));
    const end = () => setPrinting(false);
    window.addEventListener("beforeprint", start);
    window.addEventListener("afterprint", end);
    return () => {
      window.removeEventListener("beforeprint", start);
      window.removeEventListener("afterprint", end);
    };
  }, []);
  return printing;
}
