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
    expect(
      screen.getByRole("button", {
        name: /^Nadia's birthday, Jan \d+, All day$/,
      }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /Go to today, Thu, Oct 15/ })).toBeInTheDocument();
  });

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
    const before = screen.getAllByRole("button", { name: /All day/ }).length;
    const [first] = within(
      screen.getByRole("heading", { name: "Calendars" }).closest("section") ?? document.body,
    ).getAllByRole("checkbox");
    fireEvent.click(first!);
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: /All day/ }).length).toBeLessThan(before),
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
      await screen.findByRole("button", { name: "Ship the calendar rewrite, Feb 10, All day" }),
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
      await screen.findByRole("button", { name: "Ship the calendar rewrite, May 20, All day" }),
    ).toBeInTheDocument();
  });
});
