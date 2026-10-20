import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { YearViewRouterPort } from "@/components/year-view/year-view-ports";
import { AppProviders } from "@/providers";
import { DemoYearView } from "./demo-year-view";
import { DESKTOP_SIDEBAR_QUERY } from "@/components/use-modal-drawer";

// The demo is the real year view on an in-memory store, so these tests drive
// the whole UI through the same roles a visitor would use.

const reducedMotion = (query: string) => ({
  matches: true,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false,
});

function renderDemo(search: YearViewRouterPort["search"] = {}) {
  const navigate = vi.fn<YearViewRouterPort["navigate"]>();
  const view = render(
    <AppProviders>
      <DemoYearView year={2026} router={{ search, navigate }} />
    </AppProviders>,
  );
  return { navigate, ...view };
}

// With no layout every month column sits at y = 0, so a pointer's clientY is
// its offset into the month: row height (30px) times the zero-based day.
const clickDay = (element: Element, day: number) =>
  fireEvent.click(element, { clientY: (day - 1) * 30 + 5 });

const grid = () => screen.getByRole("application");
const press = (key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...init }));
  });

// jsdom has no layout, so the virtualized grid would see a zero-width viewport
// and render only the first months. A wide viewport keeps the whole year in the DOM.
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");

describe("DemoYearView", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 10_000,
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 15, 9));
    vi.stubGlobal("matchMedia", reducedMotion);
  });
  afterEach(() => {
    cleanup();
    if (clientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidth);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("renders the sample year as one button per event", () => {
    renderDemo();
    expect(screen.getByRole("region", { name: "Calendar for 2026" })).toBeInTheDocument();
    const birthdayButton = screen.getByText("Nadia's birthday", { exact: true }).closest("button");
    expect(birthdayButton).toBeVisible();
    expect(birthdayButton).toHaveAccessibleName("Nadia's birthday");
    expect(screen.getByRole("button", { name: /Go to today, Thu, Oct 15/ })).toBeInTheDocument();
  }, 15_000);

  it("filters events by search and reports the match count", async () => {
    renderDemo();
    fireEvent.change(screen.getByRole("searchbox", { name: "Search events" }), {
      target: { value: "marathon" },
    });
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^Nadia's birthday/ })).not.toBeInTheDocument(),
    );
    expect(screen.getAllByRole("button", { name: /^Marathon training block/ })).not.toHaveLength(0);
  });

  it("hides a calendar's events when it is unchecked", async () => {
    renderDemo();
    const before = document.querySelectorAll('[data-event-chip="true"]').length;
    const [first] = within(
      screen.getByRole("heading", { name: "Calendars" }).closest("section") ?? document.body,
    ).getAllByRole("checkbox");
    fireEvent.click(first!);
    await waitFor(() =>
      expect(document.querySelectorAll('[data-event-chip="true"]').length).toBeLessThan(before),
    );
  });

  it("navigates years through the router port", () => {
    const { navigate } = renderDemo();
    fireEvent.click(screen.getByRole("button", { name: "Next year" }));
    expect(navigate).toHaveBeenLastCalledWith(expect.objectContaining({ year: 2027 }));
    fireEvent.click(screen.getByRole("button", { name: "Previous year" }));
    expect(navigate).toHaveBeenLastCalledWith(expect.objectContaining({ year: 2025 }));
  });

  it("toggles the sidebar with its button and the S shortcut", () => {
    renderDemo();
    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    expect(screen.queryByRole("button", { name: "Collapse sidebar" })).not.toBeInTheDocument();
    press("s");
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
  });

  it("opens the keyboard help and the command palette", async () => {
    renderDemo();
    fireEvent.click(screen.getByRole("button", { name: "Show keyboard shortcuts" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    press("k", { metaKey: true });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("creates, renames and deletes an event with the keyboard", async () => {
    renderDemo();
    act(() => grid().focus());

    press("n");
    const createDialog = await screen.findByRole("dialog", { name: "New event" });
    fireEvent.change(within(createDialog).getByRole("textbox", { name: "Event title" }), {
      target: { value: "Ship coverage" },
    });
    fireEvent.click(within(createDialog).getByRole("button", { name: "Add event" }));
    expect(await screen.findByRole("button", { name: /^Ship coverage/ })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "New event" })).not.toBeInTheDocument(),
    );

    press("Enter");
    const panel = await screen.findByRole("listbox", { name: /^Events for/ });
    const index = within(panel)
      .getAllByRole("option")
      .findIndex((option) => option.textContent?.startsWith("Ship coverage"));
    for (let step = 0; step < index; step += 1) press("ArrowDown");
    expect(within(panel).getByRole("option", { selected: true })).toHaveTextContent(
      "Ship coverage",
    );

    press("e");
    const editDialog = await screen.findByRole("dialog", { name: "Edit event" });
    const title = within(editDialog).getByRole("textbox", { name: "Event title" });
    expect(title).toHaveValue("Ship coverage");
    fireEvent.change(title, { target: { value: "Ship more coverage" } });
    fireEvent.click(within(editDialog).getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Edit event" })).not.toBeInTheDocument(),
    );
    expect(screen.getAllByRole("button", { name: /^Ship more coverage/ }).length).toBeGreaterThan(
      0,
    );

    press("Backspace", { metaKey: true });
    const deleteDialog = await screen.findByRole("dialog", { name: "Delete event?" });
    fireEvent.click(within(deleteDialog).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(screen.queryByText("Ship more coverage")).not.toBeInTheDocument());
  });

  it("opens day details when an event is clicked", async () => {
    renderDemo();
    clickDay(screen.getByRole("button", { name: /^Nadia's birthday/ }), 24);
    const panel = await screen.findByRole("listbox", { name: /^Events for January/ });
    expect(within(panel).getByRole("option", { selected: true })).toHaveTextContent(
      "Nadia's birthday",
    );
  });

  it("refuses to drag an event from a read-only calendar", () => {
    renderDemo();
    const dragStart = createEvent.dragStart(
      screen.getByRole("button", { name: /^Nadia's birthday/ }),
    );
    fireEvent(screen.getByRole("button", { name: /^Nadia's birthday/ }), dragStart);
    expect(dragStart.defaultPrevented).toBe(true);
  });

  it("moves an event by dragging it onto another day", async () => {
    renderDemo();
    const chip = screen.getByRole("button", { name: /^Ship the calendar rewrite/ });
    const store = new Map<string, string>();
    const dataTransfer = {
      get types() {
        return [...store.keys()];
      },
      setData: (type: string, value: string) => store.set(type, value),
      getData: (type: string) => store.get(type) ?? "",
      effectAllowed: "none",
      dropEffect: "none",
    };
    const target = document.querySelector('[data-month-column="1"] [data-day-cell-frame="10"]');
    if (!target) throw new Error("Feb 10 is not rendered");

    fireEvent.dragStart(chip, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    expect(
      await screen.findByRole("button", { name: /^Ship the calendar rewrite/ }),
    ).toBeInTheDocument();
  });

  it("moves the selected event to a typed date with M", async () => {
    renderDemo({ month: 3, day: 27 });
    act(() => grid().focus());
    press("Enter");
    const panel = await screen.findByRole("listbox", { name: "Events for March 27" });
    expect(within(panel).getByRole("option", { selected: true })).toHaveTextContent(
      "Marathon training block",
    );
    press("]");
    expect(within(panel).getByRole("option", { selected: true })).toHaveTextContent(
      "Ship the calendar rewrite",
    );

    press("m");
    const dialog = await screen.findByRole("dialog", { name: "Move event" });
    fireEvent.change(within(dialog).getByLabelText("Start date"), {
      target: { value: "2026-05-20" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Move" }));

    expect(
      await screen.findByRole("button", { name: /^Ship the calendar rewrite/ }),
    ).toBeInTheDocument();
  });

  it("navigates by month, year input, and today", () => {
    const { navigate } = renderDemo({ month: 3, day: 27 });

    fireEvent.change(screen.getByRole("combobox", { name: "Jump to month" }), {
      target: { value: "5" },
    });
    expect(navigate).toHaveBeenLastCalledWith({
      year: 2026,
      search: { month: 6, day: 27 },
      replace: true,
    });

    fireEvent.click(screen.getByRole("button", { name: /^Go to today/ }));
    expect(navigate).toHaveBeenLastCalledWith({
      year: 2026,
      search: { month: 10, day: 15 },
      replace: false,
    });

    const yearInput = screen.getByLabelText("Year");
    fireEvent.keyDown(yearInput, { key: "ArrowUp" });
    expect(navigate).toHaveBeenLastCalledWith(expect.objectContaining({ year: 2027 }));
    fireEvent.change(yearInput, { target: { value: "2031" } });
    expect(navigate).toHaveBeenLastCalledWith(expect.objectContaining({ year: 2031 }));
  });

  it("binds / to search and T to today, but not while typing", () => {
    const { navigate } = renderDemo({ month: 3, day: 27 });
    const search = screen.getByRole("searchbox", { name: "Search events" });

    press("/");
    expect(search).toHaveFocus();
    fireEvent.keyDown(search, { key: "t" });
    expect(navigate).not.toHaveBeenCalled();

    press("t");
    expect(navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: { month: 10, day: 15 } }),
    );
  });
});

describe("DemoYearView on a narrow screen", () => {
  // Below 768px the sidebar is a modal drawer. Reduced motion keeps the tour off.
  const narrow = (query: string) => ({
    ...reducedMotion(query),
    matches: query !== DESKTOP_SIDEBAR_QUERY,
  });
  const drawer = () =>
    document.querySelector<HTMLElement>('aside[role="dialog"][aria-label="Calendars"]')!;
  const openDrawer = () => {
    const opener = screen.getByRole("button", { name: "Open calendars" });
    opener.focus();
    fireEvent.click(opener);
    return within(drawer()).getAllByRole("checkbox").at(-1)!;
  };

  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 10_000,
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 15, 9));
    vi.stubGlobal("matchMedia", narrow);
  });
  afterEach(() => {
    cleanup();
    if (clientWidth) Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidth);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it("opens the drawer from the keyboard with focus inside it", () => {
    renderDemo();
    const opener = screen.getByRole("button", { name: "Open calendars" });
    opener.focus();
    // Enter on a top-bar control presses it; the grid does not claim it.
    expect(fireEvent.keyDown(opener, { key: "Enter" })).toBe(true);
    expect(fireEvent.keyDown(opener, { key: " ", code: "Space" })).toBe(true);
    fireEvent.click(opener);
    expect(drawer()).toHaveAttribute("aria-hidden", "false");
    expect(drawer().contains(document.activeElement)).toBe(true);
    expect(screen.getByRole("main", { hidden: true })).toHaveAttribute("inert");
  });

  it("keeps grid keys inside the drawer from moving the grid behind it", () => {
    const { navigate } = renderDemo({ month: 3, day: 27, details: true });
    const tasks = openDrawer();
    navigate.mockClear();
    expect(fireEvent.keyDown(tasks, { key: "ArrowDown" })).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("/ closes the drawer, then focuses search", () => {
    renderDemo();
    const tasks = openDrawer();
    tasks.focus();
    fireEvent.keyDown(tasks, { key: "/" });
    expect(drawer()).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("searchbox", { name: "Search events" })).toHaveFocus();
  });

  it.each([{ ctrlKey: true }, { metaKey: true }])(
    "%o+K closes the drawer and focuses the command palette, then the grid",
    async (modifier) => {
      renderDemo();
      const tasks = openDrawer();
      tasks.focus();
      fireEvent.keyDown(tasks, { key: "k", ...modifier });
      expect(drawer()).toHaveAttribute("aria-hidden", "true");
      const commands = await screen.findByRole("dialog", { name: "Commands" });
      await waitFor(() => expect(within(commands).getByRole("combobox")).toHaveFocus());

      fireEvent.keyDown(within(commands).getByRole("combobox"), { key: "Escape" });
      await waitFor(() =>
        expect(screen.queryByRole("dialog", { name: "Commands" })).not.toBeInTheDocument(),
      );
      expect(grid()).toHaveFocus();
    },
  );

  it("keeps search typing and command input shortcuts with their input", async () => {
    renderDemo();
    const search = screen.getByRole("searchbox", { name: "Search events" });
    search.focus();
    expect(fireEvent.keyDown(search, { key: "/" })).toBe(true);
    expect(fireEvent.keyDown(search, { key: "k", ctrlKey: true })).toBe(true);
    expect(search).toHaveFocus();
    expect(screen.queryByRole("dialog", { name: "Commands" })).not.toBeInTheDocument();
    openDrawer();
    fireEvent.keyDown(document.activeElement!, { key: "k", ctrlKey: true });
    const commands = await screen.findByRole("dialog", { name: "Commands" });
    const input = within(commands).getByRole("combobox");
    await waitFor(() => expect(input).toHaveFocus());
    expect(fireEvent.keyDown(input, { key: "/" })).toBe(true);
    expect(input).toHaveFocus();
  });

  it("leaves focus with a dialog that a command opened", async () => {
    renderDemo();
    press("k", { ctrlKey: true });
    const commands = await screen.findByRole("dialog", { name: "Commands" });
    fireEvent.click(within(commands).getByText("Show keyboard shortcuts"));
    const help = await screen.findByRole("dialog", { name: "Keyboard shortcuts" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Commands" })).not.toBeInTheDocument(),
    );
    expect(help.contains(document.activeElement)).toBe(true);
  });
});
