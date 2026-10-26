import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { YEAR_GRID_HEADER_HEIGHT } from "@/components/year-view/constants";
import { rowScrollTop, useKeepCellInView } from "@/components/year-view/use-keep-cell-in-view";
import type { KeyboardCell } from "@/components/year-view/year-grid-keyboard";

// The production grid at 1440x900: a 53 px sticky header, rows starting at
// content y=61 after 8 px of top padding, 30 px rows, 743 px of viewport.
const HEADER = 53;
const FIRST_ROW_TOP = 61;
const ROW = 30;
const VIEWPORT = 743;
const rowTopOf = (day: number) => FIRST_ROW_TOP + (day - 1) * ROW;

describe("rowScrollTop", () => {
  const base = { rowHeight: ROW, viewportHeight: VIEWPORT, stickyTop: HEADER };

  it("keeps the scroll position when the row is fully visible below the header", () => {
    expect(rowScrollTop({ ...base, rowTop: rowTopOf(12), scrollTop: 0 })).toBe(0);
    expect(rowScrollTop({ ...base, rowTop: rowTopOf(20), scrollTop: 100 })).toBe(100);
  });

  it("scrolls a late-month row up until its bottom edge meets the viewport bottom", () => {
    // Oct 24: rows end at 61 + 24 * 30 = 781 > 743, so the row was cut off.
    expect(rowScrollTop({ ...base, rowTop: rowTopOf(24), scrollTop: 0 })).toBe(781 - VIEWPORT);
    expect(rowScrollTop({ ...base, rowTop: rowTopOf(31), scrollTop: 0 })).toBe(
      rowTopOf(31) + ROW - VIEWPORT,
    );
  });

  it("treats a row that only touches the viewport bottom as visible", () => {
    const scrollTop = rowTopOf(24) + ROW - VIEWPORT;
    expect(rowScrollTop({ ...base, rowTop: rowTopOf(24), scrollTop })).toBe(scrollTop);
  });

  it("scrolls a row hidden under the sticky header down to just below it", () => {
    // Scrolled to the end of the month, then back up to the 11th.
    expect(rowScrollTop({ ...base, rowTop: rowTopOf(11), scrollTop: 376 })).toBe(
      rowTopOf(11) - HEADER,
    );
  });

  it("treats a row partly under the header as hidden", () => {
    const scrollTop = rowTopOf(11) - HEADER + 1;
    expect(rowScrollTop({ ...base, rowTop: rowTopOf(11), scrollTop })).toBe(rowTopOf(11) - HEADER);
  });

  it("never scrolls above the top of the grid", () => {
    expect(rowScrollTop({ ...base, rowTop: 10, scrollTop: 40 })).toBe(0);
  });
});

/**
 * A scroll container with the layout jsdom does not compute: viewport height,
 * scroll position, a sticky header and a mounted month column.
 */
function makeGrid({
  scrollTop = 0,
  headerHeight = HEADER as number | null,
  firstRowTop = FIRST_ROW_TOP as number | null,
} = {}) {
  const container = document.createElement("div");
  const scrollTo = vi.fn<(options?: ScrollToOptions) => void>();
  Object.assign(container, { scrollTo });
  Object.defineProperty(container, "clientHeight", { value: VIEWPORT });
  Object.defineProperty(container, "clientWidth", { value: 1152 });
  Object.defineProperty(container, "scrollTop", { value: scrollTop });
  // The container sits 157 px down the page, like below the desktop top bar.
  container.getBoundingClientRect = () => new DOMRect(288, 157, 1152, VIEWPORT);

  if (headerHeight !== null) {
    const header = document.createElement("div");
    header.setAttribute("data-year-grid-header", "");
    Object.defineProperty(header, "offsetHeight", { value: headerHeight });
    container.append(header);
  }
  if (firstRowTop !== null) {
    const column = document.createElement("div");
    column.setAttribute("data-month-column", "9");
    column.getBoundingClientRect = () => new DOMRect(750, 157 + firstRowTop - scrollTop, 279, 930);
    container.append(column);
  }
  return { container, scrollTo };
}

function render(cell: KeyboardCell, grid: ReturnType<typeof makeGrid>) {
  return renderHook(
    (props: { cell: KeyboardCell }) =>
      useKeepCellInView({
        cell: props.cell,
        scrollRef: { current: grid.container },
        monthHeaderRefs: { current: [] },
        rowHeight: ROW,
      }),
    { initialProps: { cell } },
  );
}

describe("useKeepCellInView", () => {
  it("places a late-month day fully in view on first render, without animating", () => {
    const grid = makeGrid();
    render({ month: 9, day: 27 }, grid);

    expect(grid.scrollTo).toHaveBeenCalledTimes(1);
    expect(grid.scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: rowTopOf(27) + ROW - VIEWPORT, behavior: "instant" }),
    );
  });

  it("leaves an early-month day where it is", () => {
    const grid = makeGrid();
    render({ month: 9, day: 12 }, grid);

    expect(grid.scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: 0, behavior: "instant" }),
    );
  });

  it("scrolls smoothly on later moves", () => {
    const grid = makeGrid();
    const view = render({ month: 9, day: 12 }, grid);
    view.rerender({ cell: { month: 9, day: 31 } });

    expect(grid.scrollTo).toHaveBeenCalledTimes(2);
    expect(grid.scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: rowTopOf(31) + ROW - VIEWPORT, behavior: "smooth" }),
    );
  });

  it("measures the rows from the month column at the current scroll position", () => {
    // Scrolled to the 31st, the month column's top is above the container.
    const grid = makeGrid({ scrollTop: 376 });
    render({ month: 9, day: 11 }, grid);

    expect(grid.scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: rowTopOf(11) - HEADER }),
    );
  });

  it("uses the measured header height rather than a constant", () => {
    const grid = makeGrid({ scrollTop: 376, headerHeight: 80 });
    render({ month: 9, day: 11 }, grid);

    expect(grid.scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: rowTopOf(11) - 80 }),
    );
  });

  it("falls back to the header constant when nothing is laid out", () => {
    const grid = makeGrid({ headerHeight: null, firstRowTop: null });
    render({ month: 9, day: 31 }, grid);

    expect(grid.scrollTo).toHaveBeenLastCalledWith(
      expect.objectContaining({ top: YEAR_GRID_HEADER_HEIGHT + 31 * ROW - VIEWPORT }),
    );
  });

  it("does nothing without a scroll container", () => {
    expect(() =>
      renderHook(() =>
        useKeepCellInView({
          cell: { month: 0, day: 1 },
          scrollRef: { current: null },
          monthHeaderRefs: { current: [] },
          rowHeight: ROW,
        }),
      ),
    ).not.toThrow();
  });
});
