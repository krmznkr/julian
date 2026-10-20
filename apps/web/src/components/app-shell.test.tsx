import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import AppShell from "./app-shell";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function media(initial: boolean) {
  let desktop = initial;
  const listeners = new Set<() => void>();
  const add = vi.fn<(_type: string, listener: () => void) => void>((_type, listener) => {
    listeners.add(listener);
  });
  const remove = vi.fn<(_type: string, listener: () => void) => void>((_type, listener) => {
    listeners.delete(listener);
  });
  const query = {
    ...window.matchMedia(""),
    get matches() {
      return desktop;
    },
    addEventListener: add,
    removeEventListener: remove,
  };
  const match = vi.spyOn(window, "matchMedia").mockReturnValue(query);
  return {
    match,
    add,
    remove,
    listeners,
    resize: (next: boolean) =>
      act(() => {
        desktop = next;
        listeners.forEach((listener) => listener());
      }),
  };
}

it.each([true, false])(
  "mounts only the active sidebar on the first commit (desktop=%s), with a stable subscription",
  (desktop) => {
    const viewport = media(desktop);
    const mounted = vi.fn<() => void>();
    const unmounted = vi.fn<() => void>();
    function Sidebar() {
      useEffect(() => {
        mounted();
        return unmounted;
      }, []);
      return <button type="button">Sidebar child</button>;
    }
    const props = {
      sidebar: <Sidebar />,
      topbar: <span>Top bar</span>,
      mobileSidebarOpen: false,
      onMobileSidebarOpenChange: vi.fn<() => void>(),
    };
    const view = render(
      <AppShell {...props}>
        <p>Calendar</p>
      </AppShell>,
    );
    expect(view.container.querySelectorAll("aside")).toHaveLength(2);
    expect(view.container.querySelectorAll("aside button")).toHaveLength(1);
    const active = () => view.container.querySelector("aside button")?.closest("aside");
    expect(active()?.getAttribute("role")).toBe(desktop ? null : "dialog");
    expect(mounted).toHaveBeenCalledOnce();
    expect(viewport.match).toHaveBeenCalledWith("(min-width: 48rem)");
    expect(viewport.listeners.size).toBe(1);
    view.rerender(
      <AppShell {...props} banner={<span>Banner</span>} sidebarCollapsed>
        <p>Calendar</p>
      </AppShell>,
    );
    expect(mounted).toHaveBeenCalledOnce();
    expect(viewport.add).toHaveBeenCalledOnce();
    viewport.resize(desktop);
    expect(mounted).toHaveBeenCalledOnce();
    viewport.resize(!desktop);
    expect(active()?.getAttribute("role")).toBe(desktop ? "dialog" : null);
    expect(mounted).toHaveBeenCalledTimes(2);
    expect(unmounted).toHaveBeenCalledOnce();
    expect(view.container.querySelectorAll("aside button")).toHaveLength(1);
    view.unmount();
    expect(viewport.listeners.size).toBe(0);
    expect(viewport.remove).toHaveBeenCalledOnce();
  },
);

function DrawerDemo({ empty = false }: { empty?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <AppShell
      mobileSidebarOpen={open}
      onMobileSidebarOpenChange={setOpen}
      topbar={
        <button type="button" onClick={() => setOpen(true)}>
          Open drawer
        </button>
      }
      sidebar={
        empty ? null : (
          <>
            <button type="button">First</button>
            <button type="button">Last</button>
          </>
        )
      }
    >
      <div data-year-grid-root="" tabIndex={0}>
        Grid
      </div>
    </AppShell>
  );
}

it("traps focus, handles Escape/backdrop, restores focus and removes the trap on resize", () => {
  const viewport = media(false);
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    new DOMRect(),
  ] as unknown as DOMRectList);
  const view = render(<DrawerDemo />);
  const opener = screen.getByRole("button", { name: "Open drawer" });
  opener.focus();
  fireEvent.click(opener);
  const drawer = screen.getByRole("dialog", { name: "Calendars" });
  const first = screen.getByRole("button", { name: "First" });
  const last = screen.getByRole("button", { name: "Last" });
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
  expect(last).toHaveFocus();
  fireEvent.keyDown(last, { key: "Tab" });
  expect(first).toHaveFocus();
  // Middle focus movement remains the browser's responsibility.
  expect(fireEvent.keyDown(first, { key: "Tab" })).toBe(true);
  opener.focus();
  expect(first).toHaveFocus();
  fireEvent.keyDown(first, { key: "ArrowDown" });
  fireEvent.keyDown(first, { key: "Escape" });
  expect(opener).toHaveFocus();
  expect(drawer).toHaveAttribute("inert");
  expect(drawer).toHaveAttribute("aria-hidden", "true");
  fireEvent.click(opener);
  fireEvent.click(screen.getByRole("button", { name: "Close sidebar" }));
  expect(opener).toHaveFocus();
  fireEvent.click(opener);
  viewport.resize(true);
  expect(drawer).toHaveAttribute("inert");
  opener.focus();
  expect(opener).toHaveFocus();
  viewport.resize(false);
  expect(drawer).toHaveAttribute("aria-hidden", "true");
  expect(view.container.querySelectorAll("aside button")).toHaveLength(2);
});

it("closes the drawer and releases its trap when a portaled dialog takes focus", () => {
  media(false);
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([
    new DOMRect(),
  ] as unknown as DOMRectList);
  render(<DrawerDemo />);
  const opener = screen.getByRole("button", { name: "Open drawer" });
  opener.focus();
  fireEvent.click(opener);
  const drawer = screen.getByRole("dialog", { name: "Calendars" });
  render(
    <div data-slot="dialog-content" data-state="open">
      <input aria-label="Portaled dialog" />
    </div>,
  );
  const input = screen.getByRole("textbox", { name: "Portaled dialog" });
  act(() => input.focus());
  expect(drawer).toHaveAttribute("inert");
  input.focus();
  expect(input).toHaveFocus();
});

it("focuses an empty drawer and falls back to the grid when the opener becomes hidden", () => {
  const viewport = media(false);
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([] as unknown as DOMRectList);
  render(<DrawerDemo empty />);
  const opener = screen.getByRole("button", { name: "Open drawer" });
  opener.focus();
  fireEvent.click(opener);
  const drawer = screen.getByRole("dialog", { name: "Calendars" });
  expect(drawer).toHaveFocus();
  fireEvent.keyDown(drawer, { key: "Tab" });
  expect(drawer).toHaveFocus();
  fireEvent.keyDown(drawer, { key: "Tab", shiftKey: true });
  expect(drawer).toHaveFocus();
  viewport.resize(true);
  expect(screen.getByText("Grid")).toHaveFocus();
});
