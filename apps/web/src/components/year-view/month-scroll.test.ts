import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FALLBACK_MONTH_WIDTH,
  MONTH_GAP_PX,
  monthCenterScrollLeft,
  monthScrollLeft,
  readMonthColumnWidth,
  scrollMonthIntoView,
} from "./month-scroll";

const MONTH = 196;
const GUTTER = 44;

/** Where a month lands on screen after scrolling to `scrollLeft`. */
function placement(monthLeft: number, scrollLeft: number, viewportWidth: number) {
  const left = monthLeft - scrollLeft;
  return {
    contextBefore: left - GUTTER,
    contextAfter: viewportWidth - (left + MONTH),
  };
}

describe("monthCenterScrollLeft", () => {
  it.each([320, 360, 393, 412])(
    "fits the whole month beside the date gutter at %ipx, with equal context",
    (viewportWidth) => {
      const monthLeft = 1864;
      const scrollLeft = monthCenterScrollLeft({
        monthLeft,
        monthWidth: MONTH,
        viewportWidth,
        gutterWidth: GUTTER,
      });
      const { contextBefore, contextAfter } = placement(monthLeft, scrollLeft, viewportWidth);

      expect(contextBefore).toBeGreaterThan(0);
      expect(contextAfter).toBeGreaterThan(0);
      expect(contextBefore).toBeCloseTo(contextAfter);
    },
  );

  it("starts the month at the gutter when it is wider than the visible grid", () => {
    const scrollLeft = monthCenterScrollLeft({
      monthLeft: 1864,
      monthWidth: MONTH,
      viewportWidth: 200,
      gutterWidth: GUTTER,
    });
    expect(placement(1864, scrollLeft, 200).contextBefore).toBe(0);
  });

  it("never scrolls before the start of the year", () => {
    expect(
      monthCenterScrollLeft({
        monthLeft: 64,
        monthWidth: MONTH,
        viewportWidth: 393,
        gutterWidth: GUTTER,
      }),
    ).toBe(0);
  });
});

describe("readMonthColumnWidth", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--month-col-width");
  });

  it("reads the resolved column width", () => {
    document.documentElement.style.setProperty("--month-col-width", "196px");
    expect(readMonthColumnWidth()).toBe(196);
  });

  it("falls back instead of misreading an unresolved expression", () => {
    document.documentElement.style.setProperty("--month-col-width", "clamp(196px, 34vw, 252px)");
    expect(readMonthColumnWidth()).toBe(FALLBACK_MONTH_WIDTH);
  });
});

describe("month positions", () => {
  const SPAN = MONTH + MONTH_GAP_PX;
  /** Content x of January: grid padding, the gutter, and one gap. */
  const FIRST_MONTH_LEFT = 16 + GUTTER + MONTH_GAP_PX;

  function grid(scrollLeft: number) {
    const container = document.createElement("div");
    Object.defineProperties(container, {
      clientWidth: { value: 393 },
      clientLeft: { value: 0 },
      scrollLeft: { value: scrollLeft, writable: true },
    });
    container.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, width: 393 });
    const scrollTo = vi.fn<(options: ScrollToOptions) => void>();
    container.scrollTo = scrollTo as typeof container.scrollTo;
    return { container, scrollTo };
  }

  function mountedMonth(container: HTMLElement, index: number) {
    const element = document.createElement("div");
    Object.defineProperty(element, "offsetWidth", { value: MONTH });
    element.getBoundingClientRect = () =>
      DOMRect.fromRect({
        x: FIRST_MONTH_LEFT + index * SPAN - container.scrollLeft,
        width: MONTH,
      });
    return element;
  }

  afterEach(() => {
    document.documentElement.style.removeProperty("--month-col-width");
    document.documentElement.style.removeProperty("--day-gutter-width");
  });

  it("places a month that is not mounted exactly where it would be if it were", () => {
    document.documentElement.style.setProperty("--month-col-width", `${MONTH}px`);
    document.documentElement.style.setProperty("--day-gutter-width", `${GUTTER}px`);
    const { container } = grid(0);
    const nearStart = [0, 1, 2, 3].map((index) => mountedMonth(container, index));
    const allMounted = Array.from({ length: 12 }, (_, index) => mountedMonth(container, index));

    expect(monthScrollLeft(container, nearStart, 9)).toBeCloseTo(
      monthScrollLeft(container, allMounted, 9),
    );
  });

  it("measures from the scroll content, so the scroll position does not matter", () => {
    document.documentElement.style.setProperty("--day-gutter-width", `${GUTTER}px`);
    const atStart = grid(0).container;
    const scrolled = grid(1200).container;
    const target = (container: HTMLElement) => {
      const months: Array<HTMLElement | null> = Array.from({ length: 12 }, () => null);
      months[9] = mountedMonth(container, 9);
      return monthScrollLeft(container, months, 9);
    };

    expect(target(scrolled)).toBeCloseTo(target(atStart));
  });

  it("smoothly centres October on a 393px phone, clear of the date gutter", () => {
    document.documentElement.style.setProperty("--day-gutter-width", `${GUTTER}px`);
    const { container, scrollTo } = grid(0);
    const months = Array.from({ length: 12 }, (_, index) => mountedMonth(container, index));

    scrollMonthIntoView(container, months, 9);

    const [{ left = 0, behavior } = {}] = scrollTo.mock.calls[0] ?? [];
    const { contextBefore, contextAfter } = placement(FIRST_MONTH_LEFT + 9 * SPAN, left, 393);
    expect(behavior).toBe("smooth");
    expect(contextBefore).toBeCloseTo(contextAfter);
    expect(contextBefore).toBeGreaterThan(70);
  });

  it("estimates from the column width before anything is mounted", () => {
    const { container } = grid(0);
    expect(monthScrollLeft(container, [], 0)).toBe(0);
    expect(monthScrollLeft(container, [], 11)).toBeGreaterThan(0);
  });
});
