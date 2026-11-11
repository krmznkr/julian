import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Runtime } from "foldkit";
import { init, update } from "./app";
import { Message, Model } from "./model";
import { browserPortsLayer } from "./services";
import { subscriptions } from "./subscriptions";
import { view } from "./view";

const frames = () => vi.advanceTimersByTimeAsync(80);
const click = async (selector: string) => {
  const element = document.querySelector<HTMLElement>(selector);
  expect(element).not.toBeNull();
  element!.click();
  await frames();
};
const input = async (selector: string, value: string) => {
  const element = document.querySelector<HTMLInputElement>(selector)!;
  expect(element).not.toBeNull();
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  await frames();
};
const press = async (key: string, options: KeyboardEventInit = {}) => {
  (document.activeElement ?? document.body).dispatchEvent(
    new KeyboardEvent("keydown", { key, code: key, bubbles: true, cancelable: true, ...options }),
  );
  await frames();
};
const submit = async () => {
  document
    .querySelector("#app-dialog form")!
    .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await frames();
};
let handle: ReturnType<typeof Runtime.embed> | undefined;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-03-10T12:00:00"));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
    setTimeout(() => callback(performance.now()), 16),
  );
  vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
  Object.defineProperty(Element.prototype, "checkVisibility", {
    configurable: true,
    value: function (this: Element) {
      return !this.closest("[inert], [hidden]") && getComputedStyle(this).display !== "none";
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "show", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.removeAttribute("open");
    },
  });
  localStorage.clear();
  window.history.replaceState({}, "", "/demo/2026?month=3&day=10");
  document.body.innerHTML = '<div id="root"></div>';
  handle = Runtime.embed(
    Runtime.makeApplication({
      Model,
      init,
      update,
      view,
      subscriptions,
      container: document.getElementById("root"),
      resources: browserPortsLayer,
      routing: {
        onUrlRequest: (request) => Message.ClickedLink({ request }),
        onUrlChange: (url) => Message.ChangedUrl({ url }),
      },
    }),
  );
  await frames();
});
afterEach(async () => {
  handle?.dispose();
  await frames();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("the mounted Foldkit application", () => {
  it("creates, renames, moves and deletes through the real demo ports", async () => {
    expect(document.querySelector('[role="application"]')).not.toBeNull();
    await press("n");
    await input("#event-title", "Dentist");
    await submit();
    const dentist = () =>
      Array.from(document.querySelectorAll<HTMLButtonElement>(".calendar-event")).find(
        (element) => element.getAttribute("aria-label") === "Dentist",
      );
    expect(dentist()).toBeDefined();
    dentist()!.click();
    await frames();
    await press("e");
    await input("#event-title", "Dentist check-up");
    await submit();
    expect(document.body.textContent).toContain("Dentist check-up");
    await press("m");
    await input("#move-date", "2026-03-12");
    await submit();
    expect(
      document.querySelector('[aria-label="Dentist check-up"]')?.getAttribute("title"),
    ).toContain("Mar 12");
    await press("Backspace", { ctrlKey: true });
    await click("#confirm-delete");
    expect(document.querySelector('[aria-label="Dentist check-up"]')).toBeNull();
  });

  it("filters, searches, navigates and releases the mobile drawer", async () => {
    await click('[aria-label="Open calendars"]');
    const checks = document.querySelectorAll<HTMLInputElement>(
      '#app-dialog input[type="checkbox"]',
    );
    expect(checks).toHaveLength(6);
    checks[3]!.click();
    await frames();
    expect(checks[3]!.checked).toBe(false);
    checks[3]!.focus();
    await press("/");
    expect(document.activeElement?.id).toBe("event-search");
    await input("#event-search", "Sprint");
    expect(document.querySelector("mark")?.textContent).toBe("Sprint");
    await press("Escape");
    expect(document.querySelector("mark")).toBeNull();
    await press("ArrowDown");
    await press("ArrowRight", { shiftKey: true });
    await press("1", { code: "Digit1" });
    await vi.advanceTimersByTimeAsync(500);
    await frames();
    expect(
      document.querySelector('[role="application"]')?.getAttribute("aria-activedescendant"),
    ).toContain("-5-1");
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1200 });
    window.dispatchEvent(new Event("resize"));
    await frames();
    await click('[aria-label="Collapse sidebar"]');
    expect(document.querySelector(".desktop-sidebar")).toBeNull();
    await click('[aria-label="Expand sidebar"]');
    await click('[aria-label="Next year"]');
    expect((document.querySelector('[aria-label="Year"]') as HTMLInputElement).value).toBe("2027");
    await input('[aria-label="Year"]', "2026");
    document
      .querySelector(".year-form")!
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    await frames();
    await click('[aria-label="Go to today"]');
    expect(window.location.search).toContain("month=3&day=10");
  });

  it("changes appearance and hands off between Commands and shortcut help", async () => {
    await press("k", { ctrlKey: true });
    await input("#command-search", "keyboard");
    await press("Enter");
    expect(document.querySelector("#app-dialog")?.getAttribute("aria-label")).toBe(
      "Keyboard shortcuts",
    );
    await click("#dialog-close");
    await press("k", { metaKey: true });
    await input("#command-search", "Appearance");
    await press("Enter");
    const font = document.querySelector<HTMLSelectElement>("#font-size")!;
    font.value = "large";
    font.dispatchEvent(new Event("change", { bubbles: true }));
    await frames();
    const density = document.querySelector<HTMLSelectElement>("#density")!;
    density.value = "compact";
    density.dispatchEvent(new Event("change", { bubbles: true }));
    await frames();
    expect(document.documentElement.getAttribute("data-font-size")).toBe("large");
    expect(document.documentElement.getAttribute("data-density")).toBe("compact");
    await click("#dialog-close");
    await click('[aria-label="Switch to light theme"]');
    await click('[aria-label="Switch to dark theme"]');
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    await click('[aria-label="Switch to system theme"]');
    expect(localStorage.getItem("theme")).toBe("system");
  });

  it("renders the timeline, zooms, steps windows and prepares every month for print", async () => {
    await press("v");
    expect(document.querySelector("[data-timeline-root]")).not.toBeNull();
    const month = Array.from(
      document.querySelectorAll<HTMLButtonElement>('[aria-label="Zoom"] button'),
    ).find((element) => element.textContent === "Month")!;
    month.click();
    await frames();
    await click('[aria-label="Next month"]');
    expect(document.querySelector('[data-testid="timeline-range"]')?.textContent).toBe(
      "April 2026",
    );
    const bar = document.querySelector<HTMLButtonElement>("[data-timeline-key]")!;
    bar.focus();
    await frames();
    await press("ArrowRight");
    await press("-");
    await press("+");
    await press("[");
    await press("]");
    window.dispatchEvent(new Event("beforeprint"));
    await frames();
    expect(document.querySelectorAll("[data-month-column]")).toHaveLength(12);
    window.dispatchEvent(new Event("afterprint"));
    await frames();
    await press("v");
    await press("r");
    expect(document.querySelector('[role="application"]')).not.toBeNull();
  });
});
