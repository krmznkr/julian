import { useEffect, useRef, type MutableRefObject } from "react";
import {
  FALLBACK_MONTH_WIDTH,
  MONTH_GAP_PX,
} from "@/components/year-view/use-year-grid-virtualization";
import type { YearViewSearch } from "@/lib/year-view-url";

export function useYearViewViewport({
  scrollRef,
  monthHeaderRefs,
  setScrollEdges,
  monthsLength,
  search,
  year,
  setJumpDayHighlight,
}: {
  scrollRef: MutableRefObject<HTMLDivElement | null>;
  monthHeaderRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  setScrollEdges: (edges: { left: boolean; right: boolean }) => void;
  monthsLength: number;
  search: YearViewSearch;
  year: number;
  setJumpDayHighlight: (value: number | null) => void;
}) {
  const scrollEdgesRef = useRef<{ left: boolean; right: boolean } | null>(null);
  const edgeFrameRef = useRef<number | undefined>(undefined);

  const scrollToMonth = (targetMonth: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const target = monthHeaderRefs.current[targetMonth];
    if (target) {
      // Center the month column in the viewport rather than pinning it left.
      const left = target.offsetLeft - (container.clientWidth - target.offsetWidth) / 2;
      container.scrollTo({
        left: Math.max(0, left),
        behavior: "smooth",
      });
      return;
    }
    const rootStyle = getComputedStyle(document.documentElement);
    const widthVar = rootStyle.getPropertyValue("--month-col-width").trim();
    const parsed = Number.parseFloat(widthVar.replace("px", ""));
    const monthWidth = Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_MONTH_WIDTH;
    const left =
      targetMonth * (monthWidth + MONTH_GAP_PX) - (container.clientWidth - monthWidth) / 2;
    container.scrollTo({
      left: Math.max(0, left),
      behavior: "smooth",
    });
  };

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const updateEdges = () => {
      const left = container.scrollLeft > 4;
      const right = container.scrollLeft + container.clientWidth < container.scrollWidth - 4;
      const current = scrollEdgesRef.current;
      if (current?.left === left && current.right === right) return;
      const next = { left, right };
      // eslint-disable-next-line functional/immutable-data
      scrollEdgesRef.current = next;
      setScrollEdges(next);
    };

    const scheduleEdgeUpdate = () => {
      if (edgeFrameRef.current !== undefined) return;
      // eslint-disable-next-line functional/immutable-data
      edgeFrameRef.current = window.requestAnimationFrame(() => {
        // eslint-disable-next-line functional/immutable-data
        edgeFrameRef.current = undefined;
        updateEdges();
      });
    };

    updateEdges();
    container.addEventListener("scroll", scheduleEdgeUpdate, { passive: true });
    window.addEventListener("resize", scheduleEdgeUpdate);

    return () => {
      if (edgeFrameRef.current !== undefined) {
        window.cancelAnimationFrame(edgeFrameRef.current);
        // eslint-disable-next-line functional/immutable-data
        edgeFrameRef.current = undefined;
      }
      container.removeEventListener("scroll", scheduleEdgeUpdate);
      window.removeEventListener("resize", scheduleEdgeUpdate);
    };
  }, [monthsLength, scrollRef, setScrollEdges]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleWheel = (event: WheelEvent) => {
      const isLeftIntent = event.deltaX < 0 || (event.shiftKey && event.deltaY < 0);
      if (!isLeftIntent || container.scrollLeft > 0) return;
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) {
        event.preventDefault();
      }
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleWheel);
    };
  }, [scrollRef]);

  useEffect(() => {
    const monthValue = search.month;
    const dayValue = search.day;
    if (monthValue == null && dayValue == null) return;

    const monthIndex =
      monthValue != null && monthValue >= 1 && monthValue <= 12 ? monthValue - 1 : null;

    if (monthIndex != null) {
      const container = scrollRef.current;
      if (container) {
        const target = monthHeaderRefs.current[monthIndex];
        if (target) {
          const left = target.offsetLeft - (container.clientWidth - target.offsetWidth) / 2;
          container.scrollTo({
            left: Math.max(0, left),
            behavior: "smooth",
          });
        } else {
          const rootStyle = getComputedStyle(document.documentElement);
          const widthVar = rootStyle.getPropertyValue("--month-col-width").trim();
          const parsed = Number.parseFloat(widthVar.replace("px", ""));
          const monthWidth = Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_MONTH_WIDTH;
          const left =
            monthIndex * (monthWidth + MONTH_GAP_PX) - (container.clientWidth - monthWidth) / 2;
          container.scrollTo({
            left: Math.max(0, left),
            behavior: "smooth",
          });
        }
      }
    }

    if (dayValue != null && dayValue >= 1 && dayValue <= 31) {
      setJumpDayHighlight(dayValue);
      const timer = window.setTimeout(() => setJumpDayHighlight(null), 3500);
      return () => window.clearTimeout(timer);
    }
  }, [monthHeaderRefs, scrollRef, search, year, setJumpDayHighlight]);

  return { scrollToMonth };
}
