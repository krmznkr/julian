import { useContext, useState } from "react";
import { createPortal } from "react-dom";
import { Dialog, DropdownMenu } from "radix-ui";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AppShell from "./app-shell";
import { AppContentInertContext } from "./app-content-inert-context";
import { DESKTOP_SIDEBAR_QUERY } from "./use-modal-drawer";

// A controllable `matchMedia`, so a test can cross the 768px breakpoint.
function stubViewport(desktop: boolean) {
  const listeners = new Set<() => void>();
  const state = { desktop };
  const removed = vi.fn<() => void>();
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === DESKTOP_SIDEBAR_QUERY ? state.desktop : false;
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => {
      removed();
      listeners.delete(listener);
    },
  }));
  return {
    removed,
    listenerCount: () => listeners.size,
    resize(nextDesktop: boolean) {
      state.desktop = nextDesktop;
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

// jsdom has no layout, so it has no `checkVisibility`; browsers do.
function stubVisibility(isVisible: (element: HTMLElement) => boolean) {
  Object.defineProperty(HTMLElement.prototype, "checkVisibility", {
    configurable: true,
    value(this: HTMLElement) {
      return isVisible(this);
    },
  });
}

function Harness({
  sidebar,
  content,
  sidebarCollapsed,
  onFallback = () => {},
}: {
  sidebar?: React.ReactNode;
  content?: React.ReactNode;
  sidebarCollapsed?: boolean;
  onFallback?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AppShell
      mobileSidebarOpen={open}
      onMobileSidebarOpenChange={setOpen}
      onRestoreFocusFallback={onFallback}
      sidebarCollapsed={sidebarCollapsed}
      topbar={
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open calendars
          </button>
          <input aria-label="Search events" />
          <button type="button" onClick={() => setOpen(false)}>
            Close from outside
          </button>
        </>
      }
      banner={<p>Banner</p>}
      sidebar={
        sidebar ?? (
          <>
            <button type="button">Connect</button>
            <button type="button" disabled>
              Disabled
            </button>
            <label>
              <input type="checkbox" /> Work
            </label>
            <label>
              <input type="checkbox" /> Tasks
            </label>
          </>
        )
      }
    >
      <div tabIndex={0}>Grid</div>
      {content}
    </AppShell>
  );
}

// Like day details: a body-level portal the open drawer suspends.
function SuspendedPortal() {
  const suspended = useContext(AppContentInertContext);
  return suspended ? null : createPortal(<button type="button">Sprint 14</button>, document.body);
}

// Closed, the drawer is inert, which hides it from role queries altogether.
const drawer = () =>
  document.querySelector<HTMLElement>('aside[role="dialog"][aria-label="Calendars"]')!;
// Each control renders twice: in the drawer and in the desktop column.
const inDrawer = (name: string) =>
  [...drawer().querySelectorAll<HTMLElement>("button, input")].find(
    (element) =>
      element.textContent === name || element.parentElement?.textContent?.trim() === name,
  )!;

function openDrawer() {
  const opener = screen.getByRole("button", { name: "Open calendars" });
  opener.focus();
  fireEvent.click(opener);
  return opener;
}

const behindModal = () =>
  [document.querySelector("main"), screen.getByText("Banner").parentElement].map((element) =>
    element?.hasAttribute("inert"),
  );

describe("AppShell drawer keyboard behavior", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Reflect.deleteProperty(HTMLElement.prototype, "checkVisibility");
  });

  it("moves focus into the drawer and puts the page behind it out of reach", () => {
    stubViewport(false);
    render(<Harness />);
    expect(drawer()).toHaveAttribute("inert");
    expect(behindModal()).toEqual([false, false]);

    openDrawer();
    expect(drawer()).not.toHaveAttribute("inert");
    expect(drawer()).toHaveAttribute("aria-hidden", "false");
    expect(inDrawer("Connect")).toHaveFocus();
    expect(behindModal()).toEqual([true, true]);
    expect(
      screen.getByRole("button", { name: "Open calendars" }).closest("[inert]"),
    ).not.toBeNull();
    // The dialog and its backdrop are focus targets, never Tab stops.
    expect(drawer()).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("button", { name: "Close sidebar" })).toHaveAttribute("tabindex", "-1");
  });

  it("wraps Tab and Shift+Tab inside the drawer, skipping disabled controls", () => {
    stubViewport(false);
    render(<Harness />);
    openDrawer();
    const first = inDrawer("Connect");
    const last = inDrawer("Tasks");

    fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(last, { key: "Tab" });
    expect(first).toHaveFocus();

    // Between the ends the browser moves focus itself.
    const middle = inDrawer("Work");
    middle.focus();
    expect(fireEvent.keyDown(middle, { key: "Tab" })).toBe(true);
    expect(fireEvent.keyDown(middle, { key: "Tab", shiftKey: true })).toBe(true);

    // From the dialog container itself, Shift+Tab goes to the last control.
    drawer().focus();
    fireEvent.keyDown(drawer(), { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("closes on Escape and returns focus to the opener", () => {
    stubViewport(false);
    render(<Harness />);
    const opener = openDrawer();
    fireEvent.keyDown(inDrawer("Work"), { key: "Escape" });
    expect(drawer()).toHaveAttribute("aria-hidden", "true");
    expect(drawer()).toHaveAttribute("inert");
    expect(behindModal()).toEqual([false, false]);
    expect(opener).toHaveFocus();
  });

  it("closes from the backdrop and returns focus to the opener", () => {
    stubViewport(false);
    render(<Harness />);
    const opener = openDrawer();
    const backdrop = screen.getByRole("button", { name: "Close sidebar" });
    // Chromium focuses a clicked button before the click lands.
    backdrop.focus();
    fireEvent.click(backdrop);
    expect(drawer()).toHaveAttribute("aria-hidden", "true");
    expect(opener).toHaveFocus();
  });

  it("leaves Escape to a layer that already handled it, and ignores keys from portals", () => {
    stubViewport(false);
    const escapeLayer = (event: KeyboardEvent) => {
      if (event.key === "Escape") event.preventDefault();
    };
    document.addEventListener("keydown", escapeLayer, { capture: true });
    try {
      render(
        <Harness
          sidebar={
            <>
              <button type="button">Connect</button>
              {createPortal(<button type="button">Portaled</button>, document.body)}
            </>
          }
        />,
      );
      openDrawer();
      fireEvent.keyDown(inDrawer("Connect"), { key: "Escape" });
      expect(drawer()).toHaveAttribute("aria-hidden", "false");
    } finally {
      document.removeEventListener("keydown", escapeLayer, { capture: true });
    }

    // A portaled layer bubbles through React but is not the drawer's DOM.
    const [portaled] = screen.getAllByRole("button", { name: "Portaled" });
    fireEvent.keyDown(portaled!, { key: "Escape" });
    expect(drawer()).toHaveAttribute("aria-hidden", "false");
    portaled!.focus();
    expect(fireEvent.keyDown(portaled!, { key: "Tab" })).toBe(true);
    expect(portaled).toHaveFocus();
  });

  it("lets a nested portaled dialog close before the drawer", async () => {
    stubViewport(false);
    render(
      <Harness
        sidebar={
          <Dialog.Root>
            <Dialog.Trigger>Open nested dialog</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Content aria-describedby={undefined}>
                <Dialog.Title>Nested settings</Dialog.Title>
                <input aria-label="Nested text" />
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        }
      />,
    );
    const opener = openDrawer();
    fireEvent.click(inDrawer("Open nested dialog"));
    const nested = await screen.findByRole("dialog", { name: "Nested settings" });
    const input = screen.getByRole("textbox", { name: "Nested text" });
    expect(nested.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Nested settings" })).not.toBeInTheDocument();
    expect(drawer()).toHaveAttribute("aria-hidden", "false");
    fireEvent.keyDown(inDrawer("Open nested dialog"), { key: "Escape" });
    expect(opener).toHaveFocus();
  });

  it("lets a nested portaled menu handle Escape first", async () => {
    stubViewport(false);
    render(
      <Harness
        sidebar={
          <DropdownMenu.Root>
            <DropdownMenu.Trigger>Open nested menu</DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content>
                <DropdownMenu.Item>Menu action</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        }
      />,
    );
    openDrawer();
    fireEvent.keyDown(inDrawer("Open nested menu"), { key: "ArrowDown" });
    const item = await screen.findByRole("menuitem", { name: "Menu action" });
    fireEvent.keyDown(item, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(drawer()).toHaveAttribute("aria-hidden", "false");
  });

  it("keeps focus on the drawer itself when it has no controls", () => {
    stubViewport(false);
    render(<Harness sidebar={<p>Nothing to press</p>} />);
    openDrawer();
    expect(drawer()).toHaveFocus();
    fireEvent.keyDown(drawer(), { key: "Tab" });
    expect(drawer()).toHaveFocus();
  });

  it("does not take back focus that already moved somewhere on purpose", () => {
    stubViewport(false);
    const fallback = vi.fn<() => void>();
    render(<Harness onFallback={fallback} />);
    openDrawer();
    const elsewhere = document.createElement("button");
    document.body.append(elsewhere);
    try {
      elsewhere.focus();
      fireEvent.click(screen.getByRole("button", { name: "Close from outside" }));
      expect(drawer()).toHaveAttribute("aria-hidden", "true");
      expect(elsewhere).toHaveFocus();
      expect(fallback).not.toHaveBeenCalled();
    } finally {
      elsewhere.remove();
    }
  });

  it("falls back when the opener can no longer take focus", () => {
    stubViewport(false);
    const fallback = vi.fn<() => void>();
    render(<Harness onFallback={fallback} />);
    openDrawer();
    // Below 380px the opener is still there; past 768px it is display:none.
    stubVisibility((element) => element.textContent !== "Open calendars");
    fireEvent.keyDown(inDrawer("Connect"), { key: "Escape" });
    expect(fallback).toHaveBeenCalledTimes(1);
  });

  it("falls back when focus was in a portal that opening the drawer suspends", () => {
    stubViewport(false);
    const fallback = vi.fn<() => void>(() => screen.getByText("Grid").focus());
    render(<Harness content={<SuspendedPortal />} onFallback={fallback} />);
    screen.getByRole("button", { name: "Sprint 14" }).focus();
    // Safari does not focus a clicked button, so focus stays in the portal
    // until the same commit removes it and drops focus to the body.
    fireEvent.click(screen.getByRole("button", { name: "Open calendars" }));
    expect(screen.queryByRole("button", { name: "Sprint 14" })).not.toBeInTheDocument();
    expect(inDrawer("Connect")).toHaveFocus();

    fireEvent.keyDown(inDrawer("Connect"), { key: "Escape" });
    expect(fallback).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Grid")).toHaveFocus();
    expect(screen.getByRole("button", { name: "Sprint 14" })).toBeInTheDocument();
  });

  it("releases the modal when the window widens past the breakpoint", () => {
    const viewport = stubViewport(false);
    const fallback = vi.fn<() => void>(() => screen.getByText("Grid").focus());
    render(<Harness onFallback={fallback} />);
    openDrawer();
    expect(behindModal()).toEqual([true, true]);

    // Past 768px the drawer is display:none and so is its opener.
    stubVisibility(
      (element) => !element.closest("aside") && element.textContent !== "Open calendars",
    );
    viewport.resize(true);
    expect(drawer()).toHaveAttribute("aria-hidden", "true");
    expect(behindModal()).toEqual([false, false]);
    expect(screen.getByText("Grid")).toHaveFocus();

    // Narrowing again does not reopen it.
    viewport.resize(false);
    expect(drawer()).toHaveAttribute("aria-hidden", "true");
    expect(behindModal()).toEqual([false, false]);
  });

  it("stops listening to the breakpoint on unmount", () => {
    const viewport = stubViewport(false);
    const { unmount } = render(<Harness />);
    unmount();
    expect(viewport.removed).toHaveBeenCalled();
    expect(viewport.listenerCount()).toBe(0);
  });
});

describe("AppShell landmarks", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  // Day details add an "Event details" complementary landmark beside the
  // sidebar, so the sidebar needs a name of its own.
  it("names the desktop sidebar, and keeps the drawer a dialog rather than a landmark", () => {
    stubViewport(true);
    render(<Harness />);
    const [sidebar, ...others] = screen.getAllByRole("complementary");
    expect(others).toEqual([]);
    expect(sidebar).toBe(screen.getByRole("complementary", { name: "Calendars" }));
    expect(sidebar).not.toHaveAttribute("role");
    expect(within(sidebar!).getByRole("button", { name: "Connect" })).toBeInTheDocument();
    expect(drawer()).toHaveAttribute("role", "dialog");
  });

  // Collapsed, the sidebar is 1px wide: an empty "Calendars" landmark would
  // still be a stop in screen-reader landmark navigation.
  it("takes the collapsed desktop sidebar out of the landmarks and brings it back", () => {
    stubViewport(true);
    const { rerender } = render(<Harness />);
    expect(screen.getAllByRole("complementary")).toHaveLength(1);
    const sidebar = screen.getByRole("complementary", { name: "Calendars" });
    expect(sidebar).not.toHaveAttribute("aria-hidden");
    expect(sidebar).not.toHaveAttribute("inert");

    rerender(<Harness sidebarCollapsed />);
    expect(screen.queryAllByRole("complementary")).toEqual([]);
    expect(sidebar).toHaveAttribute("aria-hidden", "true");
    expect(sidebar).toHaveAttribute("inert");
    // The top bar, where the real toggle lives, stays reachable.
    expect(screen.getByRole("button", { name: "Open calendars" }).closest("[inert]")).toBeNull();

    rerender(<Harness sidebarCollapsed={false} />);
    expect(screen.getByRole("complementary", { name: "Calendars" })).toBe(sidebar);
    expect(within(sidebar).getByRole("button", { name: "Connect" })).toBeInTheDocument();
  });
});
