import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import { buildMonthSegments, type CalendarEvent } from "@julian/domain";
import { ROW_HEIGHT } from "@/components/year-helpers";
import { MonthDayCellsLayer } from "./month-day-cells-layer";
import type { DaySquare } from "./use-month-column";

const holiday: CalendarEvent = {
  id: "holiday",
  calendarId: "cal",
  title: "Holiday",
  start: "2026-02-15",
  end: "2026-02-16",
  allDay: true,
  isTimed: false,
};
const holidaySquare: DaySquare = {
  event: holiday,
  allDay: true,
  segment: buildMonthSegments([holiday], 2026)[1].segments[0],
};
// February 2026 starts on a Sunday.
const weekendRows = Array.from({ length: 31 }, (_, index) => index % 7 === 0 || index % 7 === 6);

function renderFebruary({
  today = 10,
  focused = null as number | null,
  dialog = null as number | null,
  strip = false,
}) {
  return render(
    <MonthDayCellsLayer
      year={2026}
      month={1}
      daysInMonth={28}
      weekendRows={weekendRows}
      multiDayLanes={1}
      hasSingleStrip={strip}
      singleDayByDay={new Map([[15, [holidaySquare]]])}
      keyboardFocusedDay={focused}
      keyboardDialogDay={dialog}
      showTodayLine
      todayRowTop={(today - 1) * ROW_HEIGHT}
    />,
  );
}

const numberOf = (container: HTMLElement, day: number) =>
  container.querySelector(`[data-day-cell-frame="${day}"] > span`);

describe("month day cells", () => {
  it("numbers only the days the month has", () => {
    const { container } = renderFebruary({});
    expect(numberOf(container, 28)).toHaveTextContent("28");
    expect(container.querySelector('[data-day-cell-frame="29"]')).toBeEmptyDOMElement();
    expect(container.querySelector("#year-grid-cell-2026-1-28")).not.toBeNull();
    expect(container.querySelector("#year-grid-cell-2026-1-29")).toBeNull();
  });

  it("marks the day whose details are open", () => {
    const { container } = renderFebruary({ dialog: 20 });
    expect(container.querySelector('[data-day-cell-frame="20"]')).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(container.querySelector('[data-day-cell-frame="21"]')).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("gives weekday and weekend numbers the same readable colour", () => {
    const { container } = renderFebruary({});
    // Contrast against each row background is measured in the browser by
    // apps/e2e/src/day-numbers.spec.ts; here only the shared class is pinned.
    expect(numberOf(container, 2)).toHaveClass("text-foreground/60");
    expect(numberOf(container, 7)).toHaveClass("text-foreground/60");
  });

  it("colours today's number with the text-safe brand colour unless it has focus", () => {
    const today = renderFebruary({ today: 10 });
    expect(numberOf(today.container, 10)).toHaveClass("text-[var(--accent-brand-text)]");
    today.unmount();

    const focused = renderFebruary({ today: 10, focused: 10 });
    const number = numberOf(focused.container, 10);
    expect(number).toHaveClass("text-foreground/80");
    expect(number).not.toHaveClass("text-[var(--accent-brand-text)]");
  });

  it("shows a day's own all-day event behind its number, in the strip when there is one", () => {
    const { container, unmount } = renderFebruary({});
    expect(within(container).getByRole("button", { name: "Holiday" })).toBeInTheDocument();
    expect(numberOf(container, 15)).toHaveClass("bg-background/55");
    expect(container.querySelector<HTMLElement>('[data-day-cell="15"]')?.style.gridColumn).toBe(
      "1 / -1",
    );
    unmount();

    const strip = renderFebruary({ strip: true });
    expect(
      strip.container.querySelector<HTMLElement>('[data-day-cell="15"]')?.style.gridColumn,
    ).toBe("-2 / -1");
  });
});
