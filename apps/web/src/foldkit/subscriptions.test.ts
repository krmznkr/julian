import { Option } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import {
  dragOverMessage,
  dragStartMessage,
  dropMessage,
  gridScroll,
  keyMessage,
} from "./subscriptions";

const EVENT_DRAG_TYPE = "application/x-julian-event";

afterEach(() => {
  document.body.replaceChildren();
});

const mount = (html: string) => {
  document.body.innerHTML = html;
  return document.body;
};

// Dispatch on a real element so `event.target` is set the way the browser sets it.
const fire = <E extends Event, A>(target: EventTarget, event: E, map: (event: E) => A): A => {
  const results: A[] = [];
  const listener = (received: Event) => {
    results.push(map(received as E));
  };
  target.addEventListener(event.type, listener);
  target.dispatchEvent(event);
  target.removeEventListener(event.type, listener);
  return results[0]!;
};

const key = (target: EventTarget, init: KeyboardEventInit) =>
  Option.getOrUndefined(
    fire(target, new KeyboardEvent("keydown", { bubbles: true, ...init }), keyMessage),
  );

const fakeTransfer = (types: string[]) => {
  const data = new Map<string, string>();
  return {
    types,
    data,
    setData: (type: string, value: string) => {
      data.set(type, value);
    },
  };
};

const dragEvent = (
  type: string,
  transfer: ReturnType<typeof fakeTransfer> | undefined,
  clientY = 0,
) =>
  // jsdom has no DragEvent; the handlers read only these fields
  Object.assign(new MouseEvent(type, { bubbles: true, clientY }), {
    dataTransfer: transfer,
  }) as unknown as DragEvent;

describe("keyMessage", () => {
  it("routes grid shortcuts with their modifiers", () => {
    const root = mount(`<div id="grid" tabindex="0"></div>`);
    expect(
      key(root.querySelector("#grid")!, { key: "ArrowRight", code: "ArrowRight", shiftKey: true }),
    ).toMatchObject({
      _tag: "PressedKey",
      key: "ArrowRight",
      shift: true,
      alt: false,
      mod: false,
      area: "grid",
    });
    expect(key(document.body, { key: "k", code: "KeyK", metaKey: true })).toMatchObject({
      key: "k",
      mod: true,
    });
    expect(key(document.body, { key: "N", code: "KeyN", shiftKey: true })).toMatchObject({
      key: "N",
    });
  });

  it("accepts digits by key code from the top row and the keypad", () => {
    expect(key(document.body, { key: "3", code: "Digit3" })).toMatchObject({ key: "3" });
    expect(key(document.body, { key: "7", code: "Numpad7" })).toMatchObject({ key: "7" });
  });

  it("ignores keys without a shortcut, composition and handled events", () => {
    expect(key(document.body, { key: "q", code: "KeyQ" })).toBeUndefined();
    expect(key(document.body, { key: "n", code: "KeyN", isComposing: true })).toBeUndefined();
    const handled = new KeyboardEvent("keydown", { key: "n", code: "KeyN", cancelable: true });
    handled.preventDefault();
    expect(fire(document.body, handled, keyMessage)).toEqual(Option.none());
  });

  it("leaves typing alone except Escape, and tags the search box", () => {
    const root = mount(
      `<input id="title" /><textarea id="notes"></textarea><input id="event-search" />
       <input id="check" type="checkbox" />`,
    );
    expect(key(root.querySelector("#title")!, { key: "n", code: "KeyN" })).toBeUndefined();
    expect(key(root.querySelector("#notes")!, { key: "/", code: "Slash" })).toBeUndefined();
    expect(key(root.querySelector("#title")!, { key: "Escape", code: "Escape" })).toMatchObject({
      area: "input",
    });
    expect(
      key(root.querySelector("#event-search")!, { key: "Escape", code: "Escape" }),
    ).toMatchObject({ area: "search" });
    // A checkbox is not a text field, so global shortcuts still apply.
    expect(key(root.querySelector("#check")!, { key: "t", code: "KeyT" })).toMatchObject({
      key: "t",
    });
  });

  it("lets buttons and links activate natively on Enter and Space", () => {
    const root = mount(`<button id="b">Go</button><a id="a" href="#x">x</a>`);
    expect(key(root.querySelector("#b")!, { key: "Enter", code: "Enter" })).toBeUndefined();
    expect(key(root.querySelector("#a")!, { key: " ", code: "Space" })).toBeUndefined();
  });

  it("keeps arrow keys native in the sidebar and toolbar but passes shortcuts through", () => {
    const root = mount(
      `<aside data-sidebar-root><button id="cal">Work</button></aside>
       <div data-mobile-sidebar><button id="mobile">Home</button></div>
       <header data-app-chrome><button id="today">Today</button></header>`,
    );
    for (const id of ["#cal", "#mobile", "#today"]) {
      expect(key(root.querySelector(id)!, { key: "ArrowDown", code: "ArrowDown" })).toBeUndefined();
    }
    expect(key(root.querySelector("#cal")!, { key: "?", code: "Slash" })).toMatchObject({
      area: "sidebar",
    });
    expect(key(root.querySelector("#mobile")!, { key: "Escape", code: "Escape" })).toMatchObject({
      area: "sidebar",
    });
    expect(key(root.querySelector("#today")!, { key: "t", code: "KeyT" })).toMatchObject({
      area: "toolbar",
    });
  });
});

describe("gridScroll", () => {
  const scrollGrid = (scrollLeft: number, clientWidth: number, columnWidth?: string) => {
    const root = mount(`<div data-year-grid-root></div>`).firstElementChild as HTMLElement;
    if (columnWidth) root.style.setProperty("--month-col-width", columnWidth);
    Object.defineProperty(root, "scrollLeft", { value: scrollLeft });
    Object.defineProperty(root, "clientWidth", { value: clientWidth });
    return Option.getOrUndefined(fire(root, new Event("scroll"), gridScroll));
  };

  it("reports the visible months with one column of overscan on each side", () => {
    // 300px columns plus a 4px gap: scrolled past four columns, showing three.
    expect(scrollGrid(4 * 304, 900, "300px")).toEqual(
      expect.objectContaining({ _tag: "ScrolledGrid", first: 3, last: 8 }),
    );
  });

  it("clamps to the year and falls back to the default column width", () => {
    expect(scrollGrid(0, 600)).toMatchObject({ first: 0, last: 5 });
    expect(scrollGrid(11 * 224, 2000)).toMatchObject({ first: 10, last: 11 });
  });

  it("ignores scrolling anywhere but the year grid", () => {
    const root = mount(`<div id="other"></div>`);
    expect(fire(root.querySelector("#other")!, new Event("scroll"), gridScroll)).toEqual(
      Option.none(),
    );
    expect(fire(document, new Event("scroll"), gridScroll)).toEqual(Option.none());
  });
});

describe("drag and drop", () => {
  const grid = () =>
    mount(
      `<div data-year-grid-root data-year="2026">
         <div data-month-column="1">
           <span id="chip" data-event-key="cal:evt" draggable="true"><b id="label">Trip</b></span>
           <span id="fixed" data-event-key="cal:task" draggable="false">Task</span>
         </div>
       </div>
       <div id="outside"></div>`,
    );

  it("starts a drag from a draggable chip, including from its children", () => {
    const root = grid();
    const transfer = fakeTransfer([]);
    expect(
      Option.getOrUndefined(
        fire(root.querySelector("#label")!, dragEvent("dragstart", transfer), dragStartMessage),
      ),
    ).toMatchObject({ _tag: "StartedDrag", key: "cal:evt" });
    expect(transfer.data.get(EVENT_DRAG_TYPE)).toBe("cal:evt");
  });

  it("does not drag read-only items or plain elements", () => {
    const root = grid();
    expect(
      fire(
        root.querySelector("#fixed")!,
        dragEvent("dragstart", fakeTransfer([])),
        dragStartMessage,
      ),
    ).toEqual(Option.none());
    expect(
      fire(
        root.querySelector("#outside")!,
        dragEvent("dragstart", fakeTransfer([])),
        dragStartMessage,
      ),
    ).toEqual(Option.none());
  });

  it("accepts a Julian event over the grid only", () => {
    const root = grid();
    const column = root.querySelector("[data-month-column]")!;
    expect(
      Option.isSome(
        fire(column, dragEvent("dragover", fakeTransfer([EVENT_DRAG_TYPE])), dragOverMessage),
      ),
    ).toBe(true);
    expect(fire(column, dragEvent("dragover", fakeTransfer(["Files"])), dragOverMessage)).toEqual(
      Option.none(),
    );
    expect(
      fire(
        root.querySelector("#outside")!,
        dragEvent("dragover", fakeTransfer([EVENT_DRAG_TYPE])),
        dragOverMessage,
      ),
    ).toEqual(Option.none());
  });

  it("drops on the day under the pointer, 30px per day", () => {
    const root = grid();
    const column = root.querySelector<HTMLElement>("[data-month-column]")!;
    column.getBoundingClientRect = () =>
      DOMRect.fromRect({ x: 0, y: 100, width: 200, height: 900 });
    const drop = (clientY: number, types = [EVENT_DRAG_TYPE]) =>
      Option.getOrUndefined(
        fire(column, dragEvent("drop", fakeTransfer(types), clientY), dropMessage),
      );
    expect(drop(100)).toMatchObject({ _tag: "DroppedEvent", date: "2026-02-01" });
    expect(drop(100 + 27 * 30 + 5)).toMatchObject({ date: "2026-02-28" });
    // February 2026 has 28 days; above the column or past its last day is not a date.
    expect(drop(100 + 28 * 30)).toBeUndefined();
    expect(drop(90)).toBeUndefined();
    expect(drop(150, ["Files"])).toBeUndefined();
  });

  it("ignores drops outside a month column", () => {
    const root = grid();
    expect(
      fire(
        root.querySelector("#outside")!,
        dragEvent("drop", fakeTransfer([EVENT_DRAG_TYPE]), 10),
        dropMessage,
      ),
    ).toEqual(Option.none());
    expect(
      fire(
        root.querySelector("[data-month-column]")!,
        dragEvent("drop", undefined, 10),
        dropMessage,
      ),
    ).toEqual(Option.none());
  });
});
