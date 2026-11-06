import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CalendarEvent, CalendarSummary } from "@julian/domain";
import { TooltipProvider } from "@/components/tooltip";
import TimelineView, { type TimelineViewProps } from "@/components/year-view/timeline-view";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const calendars: CalendarSummary[] = [
  { id: "work", summary: "Work", backgroundColor: "#3366cc" },
  { id: "home", summary: "Home", backgroundColor: "#33aa66", accessRole: "reader" },
  { id: "hidden", summary: "Hidden" },
];

function event(overrides: Partial<CalendarEvent> & { id: string }): CalendarEvent {
  return {
    title: overrides.id,
    calendarId: "work",
    start: "2026-03-02",
    end: "2026-03-05",
    allDay: true,
    isTimed: false,
    ...overrides,
  };
}

const events = [
  event({ id: "Sprint", start: "2026-03-02", end: "2026-03-14" }),
  event({ id: "Review", start: "2026-03-20", end: "2026-03-21" }),
  event({ id: "Dinner", calendarId: "home", start: "2026-03-03", end: "2026-03-04" }),
  event({ id: "Secret", calendarId: "hidden" }),
];

function renderTimeline(overrides: Partial<TimelineViewProps> = {}) {
  const props: TimelineViewProps = {
    year: 2026,
    events,
    calendars,
    selectedCalendarIds: ["work", "home"],
    monthNames: MONTHS,
    focusCell: { month: 2, day: 10 },
    focusTodaySignal: 0,
    canModifyEvent: (item) => item.calendarId === "work",
    onRequestCreateEvent: vi.fn<TimelineViewProps["onRequestCreateEvent"]>(),
    onRequestEditEvent: vi.fn<TimelineViewProps["onRequestEditEvent"]>(),
    onRequestMoveEvent: vi.fn<TimelineViewProps["onRequestMoveEvent"]>(),
    onRequestDeleteEvent: vi.fn<TimelineViewProps["onRequestDeleteEvent"]>(),
    onKeyboardHelpOpenChange: vi.fn<TimelineViewProps["onKeyboardHelpOpenChange"]>(),
    onRegisterFocus: vi.fn<TimelineViewProps["onRegisterFocus"]>(),
    onFocusDateChange: vi.fn<TimelineViewProps["onFocusDateChange"]>(),
    ...overrides,
  };
  render(
    <TooltipProvider>
      <TimelineView {...props} />
    </TooltipProvider>,
  );
  return props;
}

const bar = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name},`) });

afterEach(cleanup);

describe("TimelineView", () => {
  it("draws a row per selected calendar with its events as bars", () => {
    renderTimeline();
    expect(screen.getByRole("group", { name: "Work" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Home" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Hidden" })).not.toBeInTheDocument();
    expect(bar("Sprint")).toHaveAccessibleName("Sprint, Mar 2 – Mar 13, Work");
    expect(screen.queryByRole("button", { name: /^Secret/ })).not.toBeInTheDocument();
    expect(screen.getByTestId("timeline-range")).toHaveTextContent("Jan – Mar 2026");
  });

  it("keeps one bar in the tab order and moves focus with the arrow keys", () => {
    renderTimeline();
    expect(bar("Sprint")).toHaveAttribute("tabindex", "0");
    expect(bar("Review")).toHaveAttribute("tabindex", "-1");

    bar("Sprint").focus();
    fireEvent.keyDown(bar("Sprint"), { key: "ArrowRight" });
    expect(bar("Review")).toHaveFocus();
    expect(bar("Review")).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(bar("Review"), { key: "ArrowDown" });
    expect(bar("Dinner")).toHaveFocus();
    fireEvent.keyDown(bar("Dinner"), { key: "ArrowUp" });
    expect(bar("Sprint")).toHaveFocus();
  });

  it("edits, moves and deletes writable events from the keyboard", () => {
    const props = renderTimeline();
    bar("Sprint").focus();
    fireEvent.keyDown(bar("Sprint"), { key: "e" });
    fireEvent.keyDown(bar("Sprint"), { key: "m" });
    fireEvent.keyDown(bar("Sprint"), { key: "Backspace", ctrlKey: true });
    const sprint = expect.objectContaining({ id: "Sprint" });
    expect(props.onRequestEditEvent).toHaveBeenCalledWith(sprint);
    expect(props.onRequestMoveEvent).toHaveBeenCalledWith(sprint);
    expect(props.onRequestDeleteEvent).toHaveBeenCalledWith(sprint);

    fireEvent.keyDown(bar("Dinner"), { key: "e" });
    fireEvent.keyDown(bar("Dinner"), { key: "Delete", metaKey: true });
    expect(props.onRequestEditEvent).toHaveBeenCalledTimes(1);
    expect(props.onRequestDeleteEvent).toHaveBeenCalledTimes(1);
  });

  it("creates on the bar's day and opens the help", () => {
    const props = renderTimeline();
    fireEvent.keyDown(bar("Review"), { key: "n" });
    expect(props.onRequestCreateEvent).toHaveBeenCalledWith({ month: 2, day: 20 });
    fireEvent.keyDown(bar("Review"), { key: "?" });
    expect(props.onKeyboardHelpOpenChange).toHaveBeenCalledWith(true);
  });

  it("opens a writable event without a Google link in the editor when clicked", () => {
    const props = renderTimeline();
    fireEvent.click(bar("Sprint"));
    expect(props.onRequestEditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "Sprint" }),
    );
  });

  it("zooms with the buttons and the keyboard", () => {
    renderTimeline();
    const pressed = () =>
      screen
        .getAllByRole("button", { pressed: true })
        .map((button) => button.textContent)
        .join();
    expect(pressed()).toBe("Quarter");
    fireEvent.click(screen.getByRole("button", { name: "Month" }));
    expect(pressed()).toBe("Month");
    fireEvent.keyDown(bar("Sprint"), { key: "-" });
    expect(pressed()).toBe("Quarter");
    fireEvent.keyDown(bar("Sprint"), { key: "+" });
    fireEvent.keyDown(bar("Sprint"), { key: "=" });
    expect(pressed()).toBe("Week");
    expect(screen.getByRole("button", { name: "Next week" })).toBeInTheDocument();
  });

  it("steps whole windows and crosses into the next year", () => {
    const props = renderTimeline();
    fireEvent.click(screen.getByRole("button", { name: "Next quarter" }));
    expect(props.onFocusDateChange).toHaveBeenLastCalledWith({
      year: 2026,
      cell: { month: 3, day: 1 },
    });
    fireEvent.keyDown(bar("Sprint"), { key: "[" });
    expect(props.onFocusDateChange).toHaveBeenLastCalledWith({
      year: 2025,
      cell: { month: 9, day: 1 },
    });
  });

  it("registers a focus callback for dialogs to return to", () => {
    const props = renderTimeline();
    const register = vi.mocked(props.onRegisterFocus);
    const focus = register.mock.calls.at(-1)?.[0];
    focus?.();
    expect(bar("Sprint")).toHaveFocus();
  });

  it("explains an empty selection", () => {
    renderTimeline({ selectedCalendarIds: [] });
    expect(screen.getByText(/No calendars selected/)).toBeInTheDocument();
  });
});
