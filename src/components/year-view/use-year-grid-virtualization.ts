import { type MutableRefObject, useEffect, useMemo, useRef, useState } from "react";
import type { MonthSegments } from "@/domain";

export const FALLBACK_MONTH_WIDTH = 220;
export const MONTH_GAP_PX = 4;

export function useYearGridVirtualization({
  months,
  scrollRef,
}: {
  months: MonthSegments[];
  scrollRef: MutableRefObject<HTMLDivElement | null>;
}) {
  const [monthWidth, setMonthWidth] = useState(FALLBACK_MONTH_WIDTH);
  const [visibleRange, setVisibleRange] = useState({
    start: 0,
    end: Math.max(0, months.length - 1),
  });
  const frameRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || months.length === 0) {
      return;
    }

    const updateVisibleRange = () => {
      const rootStyle = getComputedStyle(document.documentElement);
      const widthVar = rootStyle.getPropertyValue("--month-col-width").trim();
      const parsed = Number.parseFloat(widthVar.replace("px", ""));
      const effectiveMonthWidth =
        Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_MONTH_WIDTH;
      const columnSpan = effectiveMonthWidth + MONTH_GAP_PX;
      const overscan = 2;
      const nextRange = {
        start: Math.max(0, Math.floor(container.scrollLeft / Math.max(columnSpan, 1)) - overscan),
        end: Math.min(
          months.length - 1,
          Math.ceil((container.scrollLeft + container.clientWidth) / Math.max(columnSpan, 1)) +
            overscan,
        ),
      };

      setMonthWidth((current) => (current === effectiveMonthWidth ? current : effectiveMonthWidth));
      setVisibleRange((current) =>
        current.start === nextRange.start && current.end === nextRange.end ? current : nextRange,
      );
    };

    const scheduleVisibleRangeUpdate = () => {
      if (frameRef.current !== undefined) return;
      // eslint-disable-next-line functional/immutable-data
      frameRef.current = window.requestAnimationFrame(() => {
        // eslint-disable-next-line functional/immutable-data
        frameRef.current = undefined;
        updateVisibleRange();
      });
    };

    updateVisibleRange();
    container.addEventListener("scroll", scheduleVisibleRangeUpdate, { passive: true });
    window.addEventListener("resize", scheduleVisibleRangeUpdate);

    return () => {
      if (frameRef.current !== undefined) {
        window.cancelAnimationFrame(frameRef.current);
        // eslint-disable-next-line functional/immutable-data
        frameRef.current = undefined;
      }
      container.removeEventListener("scroll", scheduleVisibleRangeUpdate);
      window.removeEventListener("resize", scheduleVisibleRangeUpdate);
    };
  }, [months.length, scrollRef]);

  const visibleMonths = useMemo(
    () => months.slice(visibleRange.start, visibleRange.end + 1),
    [months, visibleRange],
  );

  const leftCount = visibleRange.start;
  const rightCount = Math.max(0, months.length - visibleRange.end - 1);
  const leftSpacerWidth = useMemo(
    () => (leftCount <= 0 ? 0 : leftCount * monthWidth + Math.max(0, leftCount - 1) * MONTH_GAP_PX),
    [leftCount, monthWidth],
  );
  const rightSpacerWidth = useMemo(
    () =>
      rightCount <= 0 ? 0 : rightCount * monthWidth + Math.max(0, rightCount - 1) * MONTH_GAP_PX,
    [rightCount, monthWidth],
  );

  return {
    leftCount,
    leftSpacerStyle: { width: `${leftSpacerWidth}px` },
    monthWidth,
    rightCount,
    rightSpacerStyle: { width: `${rightSpacerWidth}px` },
    visibleMonths,
  };
}
