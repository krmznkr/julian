import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { CalendarEvent } from "@julian/domain";
import { DayHoverPopover, getPanelPosition } from "@/components/year-view/day-hover-popover";
import { YearViewSharedDataProvider } from "@/components/year-view/year-view-context";

const DESKTOP = { width: 1440, height: 900 };
// The October column at 1440x900: 279 px wide, starting at x=750.
const day = (top: number) => ({ left: 750, top, width: 279, height: 30 });

describe("getPanelPosition", () => {
  it("opens downward from the day's row when the tallest panel fits below it", () => {
    expect(getPanelPosition(day(300), DESKTOP)).toEqual({ left: 200, top: 300, maxHeight: 480 });
  });

  it("grows upward from a late-month day's bottom edge so it stays beside it", () => {
    // Oct 27 once scrolled into view: row 870..900.
    const position = getPanelPosition(day(870), DESKTOP);
    expect(position).toEqual({ left: 200, bottom: 8, maxHeight: 480 });
    expect(DESKTOP.height - (position.bottom ?? 0)).toBeGreaterThanOrEqual(870);
  });

  it("ends at the row's bottom for a day in the lower half", () => {
    // Oct 12: row 548..578. The panel's bottom edge lines up with the row's.
    expect(getPanelPosition(day(548), DESKTOP)).toEqual({ left: 200, bottom: 322, maxHeight: 480 });
  });

  it("shrinks rather than leaving the screen when little room is above the day", () => {
    // 500 px tall: the panel may be 300 px, but only 222 px fit above the row.
    expect(getPanelPosition(day(200), { width: 1440, height: 500 })).toEqual({
      left: 200,
      bottom: 270,
      maxHeight: 222,
    });
  });

  it("keeps the panel of a day below the screen inside the padding", () => {
    expect(getPanelPosition(day(950), DESKTOP)).toMatchObject({ bottom: 8 });
  });

  it("keeps a fixed height clear of the bottom on a screen too narrow to sit beside the day", () => {
    // Pixel 7 width: the panel overlays the grid, so it does not follow the row.
    const phone = { width: 412, height: 839 };
    const lateDay = { left: 130, top: 809, width: 195, height: 30 };
    expect(getPanelPosition(lateDay, phone)).toEqual({ left: 8, top: 351, maxHeight: 480 });
    const earlyDay = { left: 130, top: 300, width: 195, height: 30 };
    expect(getPanelPosition(earlyDay, phone)).toEqual({ left: 8, top: 300, maxHeight: 480 });
  });

  it("opens to the right of the day when there is room", () => {
    expect(
      getPanelPosition({ left: 300, top: 200, width: 200, height: 30 }, DESKTOP),
    ).toMatchObject({
      left: 506,
      top: 200,
    });
  });
});

const sprint: CalendarEvent = {
  id: "sprint",
  calendarId: "work",
  title: "Sprint 14",
  start: "2026-03-10",
  end: "2026-03-11",
  allDay: true,
  isTimed: false,
};

function renderPanel(items: { key: string; event: CalendarEvent; allDay: boolean }[]) {
  const anchor = document.createElement("div");
  document.body.append(anchor);
  return render(
    <YearViewSharedDataProvider
      value={{ calendars: [{ id: "work", summary: "Work" }], monthNames: [] }}
    >
      <DayHoverPopover
        open
        label="March 10"
        items={items}
        activeKey={undefined}
        anchorEl={anchor}
        anchorRect={day(300)}
        onSelect={() => {}}
      />
    </YearViewSharedDataProvider>,
  );
}

describe("DayHoverPopover landmarks", () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
  });

  // The desktop sidebar is also a complementary landmark, so this one needs
  // its own name for screen-reader landmark navigation.
  it("names the event details landmark", () => {
    renderPanel([{ key: "sprint", event: sprint, allDay: true }]);
    const panel = screen.getByRole("dialog", { name: "March 10 events" });
    const details = within(panel).getByRole("complementary", { name: "Event details" });
    expect(details).toHaveTextContent("Sprint 14");
    expect(details).toHaveTextContent("Work");
  });

  it("names the landmark of an empty day too", () => {
    renderPanel([]);
    const details = screen.getByRole("complementary", { name: "Event details" });
    expect(details).toHaveTextContent("No events on this day");
  });
});
