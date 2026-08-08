import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useYearGridKeyboard } from "@/components/year-view/use-year-grid-keyboard";
import { MAX_YEAR, MIN_YEAR } from "@/components/year-view/constants";
import type { KeyboardCell } from "@/components/year-view/year-grid-keyboard";
import type { CalendarEvent, EventSegment, MonthSegments } from "@/domain";

vi.mock("@/lib/open-event", () => ({
  openEventInGoogle: vi.fn<(event: CalendarEvent) => void>(),
  openDayInGoogleCalendar: vi.fn<(year: number, month: number, day: number) => void>(),
}));

import { openDayInGoogleCalendar, openEventInGoogle } from "@/lib/open-event";

type Props = Parameters<typeof useYearGridKeyboard>[0];

const YEAR = 2026;

const MONTH_NAMES = [
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

/** Today is June 10 2026 in every test unless the case overrides it. */
const TODAY: KeyboardCell = { month: 5, day: 10 };

// A five-day all-day span and a fifteen-minute meeting, both touching June 10.
// getOrderedDayEvents sorts longest -> shortest, so the order is stable:
// ["evt-long", "evt-short"].
const LONG_EVENT: CalendarEvent = {
  id: "evt-long",
  title: "Conference",
  start: "2026-06-08",
  end: "2026-06-13",
  allDay: true,
  isTimed: false,
  calendarId: "cal-1",
  htmlLink: "https://example.test/long",
};

const SHORT_EVENT: CalendarEvent = {
  id: "evt-short",
  title: "Standup",
  start: "2026-06-10T09:00:00.000Z",
  end: "2026-06-10T09:15:00.000Z",
  allDay: false,
  isTimed: true,
  calendarId: "cal-1",
  htmlLink: "https://example.test/short",
};

const LONG_SEGMENT: EventSegment = {
  id: LONG_EVENT.id,
  title: LONG_EVENT.title,
  startDay: 8,
  endDay: 12,
  lane: 0,
  calendarId: "cal-1",
  allDay: true,
  isTimed: false,
};

const SHORT_SEGMENT: EventSegment = {
  id: SHORT_EVENT.id,
  title: SHORT_EVENT.title,
  startDay: 10,
  endDay: 10,
  lane: 1,
  calendarId: "cal-1",
  allDay: false,
  isTimed: true,
};

function buildMonths(segmentsByMonth: Record<number, EventSegment[]> = {}): MonthSegments[] {
  return Array.from({ length: 12 }, (_, month) => ({
    month,
    lanes: 2,
    segments: segmentsByMonth[month] ?? [],
  }));
}

const MONTHS_WITH_EVENTS = buildMonths({ 5: [LONG_SEGMENT, SHORT_SEGMENT] });
const EVENTS = new Map<string, CalendarEvent>([
  [LONG_EVENT.id, LONG_EVENT],
  [SHORT_EVENT.id, SHORT_EVENT],
]);

function makeElement() {
  const element = document.createElement("div");
  // jsdom implements neither scrollTo nor smooth scrolling; the hook calls both
  // on every active-cell change.
  const scrollTo = vi.fn<(options?: ScrollToOptions) => void>();
  const focus = vi.fn<(options?: FocusOptions) => void>();
  Object.assign(element, { scrollTo, focus });
  return { element, scrollTo, focus };
}

function setup(overrides: Partial<Props> = {}) {
  const spies = {
    canModifyEvent: vi.fn<Props["canModifyEvent"]>(() => true),
    onRequestCreateEvent: vi.fn<Props["onRequestCreateEvent"]>(),
    onRequestEditEvent: vi.fn<Props["onRequestEditEvent"]>(),
    onRequestDeleteEvent: vi.fn<Props["onRequestDeleteEvent"]>(),
    onHelpOpenChange: vi.fn<Props["onHelpOpenChange"]>(),
    onRegisterFocusGrid: vi.fn<Props["onRegisterFocusGrid"]>(),
    shouldApplyUrlFocus: vi.fn<Props["shouldApplyUrlFocus"]>(() => false),
    markUrlFocusApplied: vi.fn<Props["markUrlFocusApplied"]>(),
    onUrlFocusChange: vi.fn<Props["onUrlFocusChange"]>(),
    onYearNavigate: vi.fn<Props["onYearNavigate"]>(),
  };

  const scrollElement = makeElement();
  const scrollRef = { current: scrollElement.element };
  const monthHeaderRefs = { current: Array.from({ length: 12 }, () => null) };

  const baseProps: Props = {
    year: YEAR,
    months: MONTHS_WITH_EVENTS,
    monthNames: MONTH_NAMES,
    events: EVENTS,
    scrollRef,
    monthHeaderRefs,
    rowHeight: 20,
    focusTodaySignal: 0,
    todayCell: TODAY,
    helpOpen: false,
    commandPaletteOpen: false,
    mutationDialogOpen: false,
    urlFocus: null,
    ...spies,
    ...overrides,
  };

  const view = renderHook((props: Props) => useYearGridKeyboard(props), {
    initialProps: baseProps,
  });

  return {
    ...view,
    rerender: (next: Partial<Props> = {}) => view.rerender({ ...baseProps, ...next }),
    ...spies,
    scrollElement,
    props: baseProps,
  };
}

function press(key: string, init: KeyboardEventInit = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
  });
}

function pressOn(target: EventTarget, key: string, init: KeyboardEventInit = {}) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const COMMIT_DELAY_MS = 650;

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useYearGridKeyboard — initial state", () => {
  it("starts on todayCell with no dialog when there is no url focus", () => {
    const { result } = setup();

    expect(result.current.activeCell).toEqual(TODAY);
    expect(result.current.dialogCell).toBeNull();
    expect(result.current.dialogActiveKey).toBeUndefined();
    expect(result.current.announcement).toBe("");
    expect(result.current.dateChangePreview).toBeNull();
  });

  it("prefers urlFocus.cell over todayCell", () => {
    const { result } = setup({
      urlFocus: { cell: { month: 2, day: 4 }, detailsOpen: false },
    });

    expect(result.current.activeCell).toEqual({ month: 2, day: 4 });
    expect(result.current.dialogCell).toBeNull();
  });

  it("opens the dialog on mount when urlFocus.detailsOpen is true", () => {
    const { result } = setup({
      urlFocus: { cell: { month: 5, day: 10 }, detailsOpen: true },
    });

    expect(result.current.activeCell).toEqual({ month: 5, day: 10 });
    expect(result.current.dialogCell).toEqual({ month: 5, day: 10 });
    // The dialog-items effect selects the first (longest) event.
    expect(result.current.dialogActiveKey).toBe("evt-long");
    expect(result.current.announcement).toBe("Conference");
  });

  it("registers and unregisters the focus-grid callback", () => {
    const { onRegisterFocusGrid, unmount, scrollElement } = setup();

    expect(onRegisterFocusGrid).toHaveBeenCalledTimes(1);
    const registered = onRegisterFocusGrid.mock.calls[0]?.[0] as () => void;
    expect(typeof registered).toBe("function");
    // Mounting also focuses the grid once.
    expect(scrollElement.focus).toHaveBeenCalledWith({ preventScroll: true });

    unmount();
    expect(onRegisterFocusGrid).toHaveBeenLastCalledWith(null);
  });
});

describe("useYearGridKeyboard — arrow movement", () => {
  it("moves by one day with ArrowDown / ArrowUp", () => {
    const { result } = setup();

    press("ArrowDown");
    expect(result.current.activeCell).toEqual({ month: 5, day: 11 });

    press("ArrowUp");
    expect(result.current.activeCell).toEqual({ month: 5, day: 10 });
  });

  it("moves by one month with ArrowRight / ArrowLeft, keeping the day", () => {
    const { result } = setup();

    press("ArrowRight");
    expect(result.current.activeCell).toEqual({ month: 6, day: 10 });

    press("ArrowLeft");
    expect(result.current.activeCell).toEqual({ month: 5, day: 10 });
  });

  it("rolls the vertical move across the month boundary (moveCellByDays uses a real Date)", () => {
    const { result } = setup({ todayCell: { month: 5, day: 30 } });

    press("ArrowDown");
    expect(result.current.activeCell).toEqual({ month: 6, day: 1 });
  });

  it("clamps horizontal movement at the ends of the year", () => {
    const { result } = setup({ todayCell: { month: 11, day: 10 } });

    press("ArrowRight");
    expect(result.current.activeCell).toEqual({ month: 11, day: 10 });
  });

  it("clamps the day when moving into a shorter month", () => {
    const { result } = setup({ todayCell: { month: 0, day: 31 } });

    // January 31 -> February (2026 has 28 days).
    press("ArrowRight");
    expect(result.current.activeCell).toEqual({ month: 1, day: 28 });
  });

  it("moves one week with Shift+ArrowDown and three months with Shift+ArrowRight", () => {
    const { result } = setup();

    press("ArrowDown", { shiftKey: true });
    expect(result.current.activeCell).toEqual({ month: 5, day: 17 });

    press("ArrowRight", { shiftKey: true });
    expect(result.current.activeCell).toEqual({ month: 8, day: 17 });
  });

  it("moves one month with Alt+ArrowDown / Alt+ArrowUp", () => {
    const { result } = setup();

    press("ArrowDown", { altKey: true });
    expect(result.current.activeCell).toEqual({ month: 6, day: 10 });

    press("ArrowUp", { altKey: true });
    expect(result.current.activeCell).toEqual({ month: 5, day: 10 });
  });

  it("announces the move, previews it, and syncs the url", () => {
    const { result, onUrlFocusChange } = setup();

    press("ArrowDown");

    expect(result.current.announcement).toBe("June 11");
    expect(result.current.dateChangePreview).toEqual({ month: 5, day: 11 });
    expect(onUrlFocusChange).toHaveBeenCalledWith(
      { cell: { month: 5, day: 11 }, detailsOpen: false },
      { replace: true },
    );

    // The preview clears itself after DATE_CHANGE_FEEDBACK_MS (700ms).
    advance(700);
    expect(result.current.dateChangePreview).toBeNull();
  });
});

describe("useYearGridKeyboard — Home / End / PageUp / PageDown", () => {
  it("Home jumps to the first day of the month", () => {
    const { result } = setup();

    press("Home");
    expect(result.current.activeCell).toEqual({ month: 5, day: 1 });
  });

  it("End jumps to the last day of the month", () => {
    const { result } = setup();

    press("End");
    expect(result.current.activeCell).toEqual({ month: 5, day: 30 });
  });

  it("PageUp / PageDown move by seven days", () => {
    const { result } = setup();

    press("PageDown");
    expect(result.current.activeCell).toEqual({ month: 5, day: 17 });

    press("PageUp");
    expect(result.current.activeCell).toEqual({ month: 5, day: 10 });
  });
});

describe("useYearGridKeyboard — day typeahead", () => {
  it("holds a digit that could start a two-digit day, then commits the pair", () => {
    const { result } = setup();

    press("1");
    // Nothing has moved yet — only the preview and the announcement.
    expect(result.current.activeCell).toEqual(TODAY);
    expect(result.current.dateChangePreview).toEqual({ month: 5, day: 1 });
    expect(result.current.announcement).toBe("Day 1");

    advance(100);
    press("5");
    expect(result.current.activeCell).toEqual({ month: 5, day: 15 });
    expect(result.current.announcement).toBe("Day 15");
  });

  it("commits the pending single digit when the window elapses", () => {
    const { result } = setup();

    press("1");
    expect(result.current.activeCell).toEqual(TODAY);

    advance(COMMIT_DELAY_MS);
    expect(result.current.activeCell).toEqual({ month: 5, day: 1 });
  });

  it("commits immediately for a digit that cannot be extended", () => {
    const { result } = setup();

    press("7");
    expect(result.current.activeCell).toEqual({ month: 5, day: 7 });
    expect(result.current.announcement).toBe("Day 7");
  });

  it("commits the buffered digit and DROPS the overflowing second digit", () => {
    const { result } = setup();

    // June has 30 days, so "3" can still start a two-digit day (30 <= 30).
    press("3");
    expect(result.current.activeCell).toEqual(TODAY);

    // 3 then 9 -> 39 is out of range. resolveDayTypeaheadInput commits the
    // buffered 3 and, because 9 cannot start a new two-digit day, simply
    // discards the 9 rather than committing it as day 9.
    press("9");
    expect(result.current.activeCell).toEqual({ month: 5, day: 3 });
  });

  it("ignores a leading zero", () => {
    const { result } = setup();

    press("0");
    expect(result.current.activeCell).toEqual(TODAY);
    expect(result.current.dateChangePreview).toBeNull();
  });

  it("bounds the typeahead by the active month's length", () => {
    const { result } = setup({ todayCell: { month: 1, day: 10 } });

    // February 2026 has 28 days: "2" can start a two-digit day (20 <= 28), but
    // 29 is out of range, so only the buffered 2 commits and the 9 is dropped.
    press("2");
    press("9");
    expect(result.current.activeCell).toEqual({ month: 1, day: 2 });
  });

  it("does not typeahead when Alt is held", () => {
    const { result } = setup();

    press("7", { altKey: true });
    expect(result.current.activeCell).toEqual(TODAY);
  });
});

describe("useYearGridKeyboard — month typeahead", () => {
  it("jumps to a month on Shift+digit that cannot be extended", () => {
    const { result } = setup();

    press("#", { shiftKey: true, code: "Digit3" });
    expect(result.current.activeCell).toEqual({ month: 2, day: 10 });
    expect(result.current.announcement).toBe("March");
  });

  it("holds Shift+1 and commits Shift+1 Shift+2 as month 12", () => {
    const { result } = setup();

    press("!", { shiftKey: true, code: "Digit1" });
    expect(result.current.activeCell).toEqual(TODAY);
    expect(result.current.announcement).toBe("January");
    expect(result.current.dateChangePreview).toEqual({ month: 0, day: 10 });

    press("@", { shiftKey: true, code: "Digit2" });
    expect(result.current.activeCell).toEqual({ month: 11, day: 10 });
  });

  it("caps the month at 12 — Shift+1 then Shift+3 commits month 1", () => {
    const { result } = setup();

    press("!", { shiftKey: true, code: "Digit1" });
    press("#", { shiftKey: true, code: "Digit3" });
    expect(result.current.activeCell).toEqual({ month: 0, day: 10 });
  });

  it("commits a pending month when the window elapses", () => {
    const { result } = setup();

    press("!", { shiftKey: true, code: "Digit1" });
    advance(COMMIT_DELAY_MS);
    expect(result.current.activeCell).toEqual({ month: 0, day: 10 });
  });

  it("clamps the day into a shorter destination month", () => {
    const { result } = setup({ todayCell: { month: 0, day: 31 } });

    press("@", { shiftKey: true, code: "Digit2" });
    advance(COMMIT_DELAY_MS);
    expect(result.current.activeCell).toEqual({ month: 1, day: 28 });
  });
});

describe("useYearGridKeyboard — day details dialog", () => {
  it("Space opens then closes the dialog on the active cell", () => {
    const { result, onUrlFocusChange } = setup();

    press(" ", { code: "Space" });
    expect(result.current.dialogCell).toEqual(TODAY);
    expect(onUrlFocusChange).toHaveBeenLastCalledWith(
      { cell: TODAY, detailsOpen: true },
      { replace: true },
    );

    press(" ", { code: "Space" });
    expect(result.current.dialogCell).toBeNull();
    expect(result.current.dialogActiveKey).toBeUndefined();
    expect(onUrlFocusChange).toHaveBeenLastCalledWith(
      { cell: TODAY, detailsOpen: false },
      { replace: true },
    );
  });

  it("Space on a different cell moves the dialog instead of closing it", () => {
    const { result } = setup();

    press(" ", { code: "Space" });
    press("Escape");
    press("ArrowDown");
    press(" ", { code: "Space" });

    expect(result.current.dialogCell).toEqual({ month: 5, day: 11 });
  });

  it("Escape closes the dialog and refocuses the grid", () => {
    const { result, scrollElement } = setup();

    press(" ", { code: "Space" });
    const focusCalls = scrollElement.focus.mock.calls.length;

    press("Escape");
    expect(result.current.dialogCell).toBeNull();
    expect(scrollElement.focus.mock.calls.length).toBeGreaterThan(focusCalls);
  });

  it("Escape is a no-op when the dialog is closed", () => {
    const { result, onUrlFocusChange } = setup();

    press("Escape");
    expect(result.current.dialogCell).toBeNull();
    expect(onUrlFocusChange).not.toHaveBeenCalled();
  });

  it("keeps the dialog on the moved cell when arrows are used while open on a day with no events", () => {
    const { result } = setup({ months: buildMonths(), events: new Map() });

    press(" ", { code: "Space" });
    expect(result.current.dialogCell).toEqual(TODAY);

    press("ArrowDown");
    expect(result.current.activeCell).toEqual({ month: 5, day: 11 });
    expect(result.current.dialogCell).toEqual({ month: 5, day: 11 });
  });
});

describe("useYearGridKeyboard — event cycling", () => {
  it("[ and ] cycle the selected event and wrap around", () => {
    const { result } = setup();

    press(" ", { code: "Space" });
    expect(result.current.dialogActiveKey).toBe("evt-long");

    press("]");
    expect(result.current.dialogActiveKey).toBe("evt-short");
    expect(result.current.announcement).toBe("Standup");

    press("]");
    expect(result.current.dialogActiveKey).toBe("evt-long");

    press("[");
    expect(result.current.dialogActiveKey).toBe("evt-short");
  });

  it("arrow keys cycle events instead of moving when the dialog has items", () => {
    const { result } = setup();

    press(" ", { code: "Space" });

    press("ArrowDown");
    expect(result.current.dialogActiveKey).toBe("evt-short");
    expect(result.current.activeCell).toEqual(TODAY);

    press("ArrowUp");
    expect(result.current.dialogActiveKey).toBe("evt-long");
    expect(result.current.activeCell).toEqual(TODAY);
  });

  it("[ and ] are ignored while the dialog is closed", () => {
    const { result } = setup();

    press("]");
    expect(result.current.dialogActiveKey).toBeUndefined();
    expect(result.current.activeCell).toEqual(TODAY);
  });

  it("Shift+arrows still move the cell even with the dialog open", () => {
    const { result } = setup();

    press(" ", { code: "Space" });
    press("ArrowDown", { shiftKey: true });

    expect(result.current.activeCell).toEqual({ month: 5, day: 17 });
    expect(result.current.dialogCell).toEqual({ month: 5, day: 17 });
  });
});

describe("useYearGridKeyboard — mutation shortcuts", () => {
  it("n asks for a new event on the active cell", () => {
    const { onRequestCreateEvent } = setup();

    press("ArrowDown");
    press("n");

    expect(onRequestCreateEvent).toHaveBeenCalledWith({ month: 5, day: 11 });
  });

  it("N (shifted) also creates — the handler lowercases the key", () => {
    const { onRequestCreateEvent } = setup();

    press("N", { shiftKey: true, code: "KeyN" });
    expect(onRequestCreateEvent).toHaveBeenCalledWith(TODAY);
  });

  it("e edits the selected event when the dialog is open", () => {
    const { onRequestEditEvent } = setup();

    press(" ", { code: "Space" });
    press("e");

    expect(onRequestEditEvent).toHaveBeenCalledWith(LONG_EVENT);
  });

  it("e does nothing when the dialog is closed", () => {
    const { onRequestEditEvent } = setup();

    press("e");
    expect(onRequestEditEvent).not.toHaveBeenCalled();
  });

  it("e does nothing when the event is not modifiable", () => {
    const canModifyEvent = vi.fn<Props["canModifyEvent"]>(() => false);
    const { onRequestEditEvent } = setup({ canModifyEvent });

    press(" ", { code: "Space" });
    press("e");

    expect(canModifyEvent).toHaveBeenCalledWith(LONG_EVENT);
    expect(onRequestEditEvent).not.toHaveBeenCalled();
  });

  it("Meta+Backspace deletes the selected event when the dialog is open", () => {
    const { onRequestDeleteEvent } = setup();

    press(" ", { code: "Space" });
    press("Backspace", { metaKey: true });

    expect(onRequestDeleteEvent).toHaveBeenCalledWith(LONG_EVENT);
  });

  it("Ctrl+Delete deletes the selected event too", () => {
    const { onRequestDeleteEvent } = setup();

    press(" ", { code: "Space" });
    press("]");
    press("Delete", { ctrlKey: true });

    expect(onRequestDeleteEvent).toHaveBeenCalledWith(SHORT_EVENT);
  });

  it("Meta+Backspace does nothing when the dialog is closed", () => {
    const { onRequestDeleteEvent } = setup();

    press("Backspace", { metaKey: true });
    expect(onRequestDeleteEvent).not.toHaveBeenCalled();
  });

  it("plain Backspace does nothing", () => {
    const { onRequestDeleteEvent } = setup();

    press(" ", { code: "Space" });
    press("Backspace");
    expect(onRequestDeleteEvent).not.toHaveBeenCalled();
  });
});

describe("useYearGridKeyboard — Enter", () => {
  it("Enter opens the dialog when it is closed", () => {
    const { result } = setup();

    press("Enter");
    expect(result.current.dialogCell).toEqual(TODAY);
  });

  it("Enter opens the selected event in Google when the dialog is open", () => {
    setup();

    press(" ", { code: "Space" });
    press("Enter");

    expect(openEventInGoogle).toHaveBeenCalledWith(LONG_EVENT);
  });

  it("Shift+Enter opens the day in Google Calendar", () => {
    setup();

    press("Enter", { shiftKey: true });
    expect(openDayInGoogleCalendar).toHaveBeenCalledWith(YEAR, 5, 10);
  });
});

describe("useYearGridKeyboard — help", () => {
  it("? toggles help through the updater form", () => {
    const { onHelpOpenChange } = setup();

    press("?", { shiftKey: true, code: "Slash" });

    expect(onHelpOpenChange).toHaveBeenCalledTimes(1);
    const updater = onHelpOpenChange.mock.calls[0]?.[0] as (prev: boolean) => boolean;
    expect(typeof updater).toBe("function");
    expect(updater(false)).toBe(true);
    expect(updater(true)).toBe(false);
  });

  it("Shift+/ toggles help as well", () => {
    const { onHelpOpenChange } = setup();

    press("/", { shiftKey: true, code: "Slash" });
    expect(onHelpOpenChange).toHaveBeenCalledTimes(1);
  });
});

describe("useYearGridKeyboard — suppressed contexts", () => {
  it.each([
    ["helpOpen", { helpOpen: true }],
    ["commandPaletteOpen", { commandPaletteOpen: true }],
    ["mutationDialogOpen", { mutationDialogOpen: true }],
  ])("ignores grid keys while %s", (_label, override) => {
    const { result, onRequestCreateEvent, onHelpOpenChange } = setup(override);

    press("ArrowDown");
    press("n");
    press(" ", { code: "Space" });
    press("?", { shiftKey: true, code: "Slash" });

    expect(result.current.activeCell).toEqual(TODAY);
    expect(result.current.dialogCell).toBeNull();
    expect(onRequestCreateEvent).not.toHaveBeenCalled();
    // Surprising but current behaviour: "?" cannot close the help dialog from
    // here, because the suppression check runs before the "?" branch.
    expect(onHelpOpenChange).not.toHaveBeenCalled();
  });

  it("still deletes on Meta+Backspace while help is open (delete runs before the guard)", () => {
    const { onRequestDeleteEvent } = setup({
      urlFocus: { cell: TODAY, detailsOpen: true },
      helpOpen: true,
    });

    press("Backspace", { metaKey: true });
    expect(onRequestDeleteEvent).toHaveBeenCalledWith(LONG_EVENT);
  });

  it("ignores keys typed into a text input", () => {
    const { result, onRequestCreateEvent } = setup();
    const input = document.createElement("input");
    document.body.append(input);

    pressOn(input, "ArrowDown");
    pressOn(input, "n");
    pressOn(input, " ", { code: "Space" });

    expect(result.current.activeCell).toEqual(TODAY);
    expect(onRequestCreateEvent).not.toHaveBeenCalled();

    input.remove();
  });

  it("control: the same bubbled event from a plain element IS handled", () => {
    const { result } = setup();
    const div = document.createElement("div");
    document.body.append(div);

    pressOn(div, "ArrowDown");
    expect(result.current.activeCell).toEqual({ month: 5, day: 11 });

    div.remove();
  });

  it("ignores keys coming from the sidebar", () => {
    const { result } = setup();
    const sidebar = document.createElement("div");
    sidebar.setAttribute("data-sidebar-root", "");
    const button = document.createElement("button");
    sidebar.append(button);
    document.body.append(sidebar);

    pressOn(button, "ArrowDown");
    expect(result.current.activeCell).toEqual(TODAY);

    sidebar.remove();
  });

  it("ignores a keydown whose default was already prevented", () => {
    const { result } = setup();

    act(() => {
      const event = new KeyboardEvent("keydown", {
        key: "ArrowDown",
        bubbles: true,
        cancelable: true,
      });
      event.preventDefault();
      window.dispatchEvent(event);
    });

    expect(result.current.activeCell).toEqual(TODAY);
  });

  it("ignores Ctrl/Meta chords other than delete", () => {
    const { result, onRequestCreateEvent } = setup();

    press("n", { metaKey: true });
    press("ArrowDown", { ctrlKey: true });

    expect(onRequestCreateEvent).not.toHaveBeenCalled();
    expect(result.current.activeCell).toEqual(TODAY);
  });
});

describe("useYearGridKeyboard — year navigation", () => {
  it("Alt+ArrowRight navigates to the next year without touching the url sync", () => {
    const { result, onYearNavigate, onUrlFocusChange } = setup();

    press("ArrowRight", { altKey: true });

    expect(onYearNavigate).toHaveBeenCalledWith(YEAR + 1, TODAY, false);
    // The active cell is updated locally, but the year change owns the url.
    expect(result.current.activeCell).toEqual(TODAY);
    expect(onUrlFocusChange).not.toHaveBeenCalled();
  });

  it("Alt+ArrowLeft navigates to the previous year and reports the dialog state", () => {
    const { onYearNavigate } = setup();

    press(" ", { code: "Space" });
    press("ArrowLeft", { altKey: true });

    expect(onYearNavigate).toHaveBeenCalledWith(YEAR - 1, TODAY, true);
  });

  it("clamps at MIN_YEAR", () => {
    const { onYearNavigate } = setup({ year: MIN_YEAR });

    press("ArrowLeft", { altKey: true });
    expect(onYearNavigate).toHaveBeenCalledWith(MIN_YEAR, TODAY, false);
  });

  it("clamps at MAX_YEAR", () => {
    const { onYearNavigate } = setup({ year: MAX_YEAR });

    press("ArrowRight", { altKey: true });
    expect(onYearNavigate).toHaveBeenCalledWith(MAX_YEAR, TODAY, false);
  });

  it("clamps the cell into the destination year (Feb 29 -> Feb 28)", () => {
    const { onYearNavigate, result } = setup({
      year: 2028,
      todayCell: { month: 1, day: 29 },
    });

    press("ArrowRight", { altKey: true });

    expect(onYearNavigate).toHaveBeenCalledWith(2029, { month: 1, day: 28 }, false);
    expect(result.current.activeCell).toEqual({ month: 1, day: 28 });
  });
});

describe("useYearGridKeyboard — focus-today signal", () => {
  it("resets to today, closes the dialog and closes help when the signal increments", () => {
    const { result, rerender, onHelpOpenChange } = setup();

    press("ArrowDown");
    press(" ", { code: "Space" });
    expect(result.current.dialogCell).toEqual({ month: 5, day: 11 });

    act(() => {
      rerender({ focusTodaySignal: 1 });
    });

    expect(result.current.activeCell).toEqual(TODAY);
    expect(result.current.dialogCell).toBeNull();
    expect(result.current.dialogActiveKey).toBeUndefined();
    expect(result.current.dateChangePreview).toEqual(TODAY);
    expect(onHelpOpenChange).toHaveBeenCalledWith(false);
  });

  it("does nothing while the signal is still 0", () => {
    const { result, rerender, onHelpOpenChange } = setup();

    press("ArrowDown");
    act(() => {
      rerender({ focusTodaySignal: 0 });
    });

    expect(result.current.activeCell).toEqual({ month: 5, day: 11 });
    expect(onHelpOpenChange).not.toHaveBeenCalled();
  });
});

describe("useYearGridKeyboard — url focus sync", () => {
  it("adopts an incoming url focus and marks it applied", () => {
    const { result, rerender, markUrlFocusApplied } = setup({
      shouldApplyUrlFocus: vi.fn<Props["shouldApplyUrlFocus"]>(() => true),
    });

    const focus = { cell: { month: 8, day: 2 }, detailsOpen: true };
    act(() => {
      rerender({
        shouldApplyUrlFocus: vi.fn<Props["shouldApplyUrlFocus"]>(() => true),
        urlFocus: focus,
      });
    });

    expect(result.current.activeCell).toEqual({ month: 8, day: 2 });
    expect(result.current.dialogCell).toEqual({ month: 8, day: 2 });
    expect(markUrlFocusApplied).toHaveBeenCalledWith(focus);
  });

  it("ignores an incoming url focus when shouldApplyUrlFocus says no", () => {
    const { result, rerender, markUrlFocusApplied } = setup();

    act(() => {
      rerender({ urlFocus: { cell: { month: 8, day: 2 }, detailsOpen: true } });
    });

    expect(result.current.activeCell).toEqual(TODAY);
    expect(markUrlFocusApplied).not.toHaveBeenCalled();
  });

  it("marks an echo of the local focus applied without moving the cell", () => {
    const { result, rerender, markUrlFocusApplied } = setup({
      shouldApplyUrlFocus: vi.fn<Props["shouldApplyUrlFocus"]>(() => true),
    });

    press("ArrowDown");
    const echo = { cell: { month: 5, day: 11 }, detailsOpen: false };

    act(() => {
      rerender({
        shouldApplyUrlFocus: vi.fn<Props["shouldApplyUrlFocus"]>(() => true),
        urlFocus: echo,
      });
    });

    expect(result.current.activeCell).toEqual({ month: 5, day: 11 });
    expect(markUrlFocusApplied).toHaveBeenCalledWith(echo);
  });

  it("closes the dialog when the incoming focus has detailsOpen false", () => {
    const { result, rerender } = setup({
      urlFocus: { cell: TODAY, detailsOpen: true },
      shouldApplyUrlFocus: vi.fn<Props["shouldApplyUrlFocus"]>(() => true),
    });

    expect(result.current.dialogCell).toEqual(TODAY);

    act(() => {
      rerender({
        urlFocus: { cell: TODAY, detailsOpen: false },
        shouldApplyUrlFocus: vi.fn<Props["shouldApplyUrlFocus"]>(() => true),
      });
    });

    expect(result.current.dialogCell).toBeNull();
  });
});

describe("useYearGridKeyboard — returned helpers", () => {
  it("openDayDetails clamps the cell and opens the dialog", () => {
    const { result } = setup();

    act(() => {
      result.current.openDayDetails({ month: 1, day: 99 });
    });

    expect(result.current.dialogCell).toEqual({ month: 1, day: 28 });
    expect(result.current.activeCell).toEqual({ month: 1, day: 28 });
  });

  it("closeDialog clears the selection and syncs the url", () => {
    const { result, onUrlFocusChange } = setup();

    press(" ", { code: "Space" });
    act(() => {
      result.current.closeDialog();
    });

    expect(result.current.dialogCell).toBeNull();
    expect(onUrlFocusChange).toHaveBeenLastCalledWith(
      { cell: TODAY, detailsOpen: false },
      { replace: true },
    );
  });

  it("focusGrid focuses the scroll container without scrolling", () => {
    const { result, scrollElement } = setup();
    scrollElement.focus.mockClear();

    act(() => {
      result.current.focusGrid();
    });

    expect(scrollElement.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("setDialogActiveKey selects an event directly", () => {
    const { result } = setup();

    press(" ", { code: "Space" });
    act(() => {
      result.current.setDialogActiveKey("evt-short");
    });

    expect(result.current.dialogActiveKey).toBe("evt-short");
  });
});
