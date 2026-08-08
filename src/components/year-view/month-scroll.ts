import { useEffect, type RefObject } from "react";

export const FALLBACK_MONTH_WIDTH = 220;
export const MONTH_GAP_PX = 4;

/**
 * The rendered width of one month column.
 *
 * Layout is driven by the `--month-col-width` custom property so CSS stays the
 * single source of truth for sizing, but the virtualiser and the scroll-to-month
 * maths both need the number in JS. Falls back when the property is missing,
 * which happens in jsdom and before first paint.
 */
export function readMonthColumnWidth(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--month-col-width")
    .trim();
  const parsed = Number.parseFloat(raw.replace("px", ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : FALLBACK_MONTH_WIDTH;
}

/**
 * Scroll a month into the centre of the viewport rather than pinning it left,
 * so the months either side stay visible for context.
 *
 * Uses the real element when it is mounted; virtualisation means a far-away
 * month may not be, in which case the position is computed from the column
 * width instead.
 */
export function scrollMonthIntoView(
  container: HTMLElement,
  monthElement: HTMLElement | null | undefined,
  monthIndex: number,
): void {
  const left = monthElement
    ? monthElement.offsetLeft - (container.clientWidth - monthElement.offsetWidth) / 2
    : monthIndex * (readMonthColumnWidth() + MONTH_GAP_PX) -
      (container.clientWidth - readMonthColumnWidth()) / 2;

  container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
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
