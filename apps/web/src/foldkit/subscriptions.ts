import { Option } from "effect";
import { Dom, Subscription } from "foldkit";
import { toDateInputValue } from "@julian/domain";
import { Message, type Model } from "./model";

const keys = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
  "Enter",
  " ",
  "Escape",
  "?",
  "/",
  "[",
  "]",
  "+",
  "=",
  "-",
  "Backspace",
  "n",
  "e",
  "m",
  "t",
  "r",
  "s",
  "v",
  "k",
]);
const keyMessage = (event: KeyboardEvent): Option.Option<Message> => {
  if (event.isComposing || event.defaultPrevented) return Option.none();
  const target = event.target instanceof HTMLElement ? event.target : null;
  const typing = target?.matches(
    "input:not([type='checkbox']):not([type='radio']):not([type='button']), textarea, select, [contenteditable='true']",
  );
  const area =
    target?.id === "event-search"
      ? "search"
      : typing
        ? "input"
        : target?.closest("[data-mobile-sidebar], [data-sidebar-root]")
          ? "sidebar"
          : target?.closest("[data-app-chrome]")
            ? "toolbar"
            : "grid";
  if (typing && event.key !== "Escape") return Option.none();
  if ((event.key === "Enter" || event.key === " ") && target?.closest("button, a, input, select"))
    return Option.none();
  if (
    !keys.has(event.key) &&
    !keys.has(event.key.toLowerCase()) &&
    !/^Digit\d$/.test(event.code) &&
    !/^Numpad\d$/.test(event.code)
  )
    return Option.none();
  // Preserve native controls in the sidebar and toolbar while keeping global shortcuts.
  if (
    (area === "sidebar" || area === "toolbar") &&
    [
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End",
      "PageUp",
      "PageDown",
    ].includes(event.key)
  )
    return Option.none();
  return Option.some(
    Message.PressedKey({
      key: event.key,
      code: event.code,
      shift: event.shiftKey,
      alt: event.altKey,
      mod: event.ctrlKey || event.metaKey,
      area,
    }),
  );
};

const gridScroll = (event: Event): Option.Option<Message> => {
  const root = event.target;
  if (!(root instanceof HTMLElement) || !root.matches("[data-year-grid-root]"))
    return Option.none();
  const width =
    Number.parseFloat(getComputedStyle(root).getPropertyValue("--month-col-width")) || 220;
  const first = Math.max(0, Math.floor(root.scrollLeft / (width + 4)) - 1);
  return Option.some(
    Message.ScrolledGrid({
      first,
      last: Math.min(11, first + Math.ceil(root.clientWidth / (width + 4)) + 2),
    }),
  );
};

export const subscriptions = Subscription.make<Model, Message>()(() => ({
  keys: Subscription.persistentEntry(
    Dom.streamFromEventFilterMapPreventDefault({
      target: () => document,
      type: "keydown",
      filterMapEvent: keyMessage,
    }),
  ),
  resize: Subscription.persistentEntry(
    Dom.streamFromEvent({
      target: () => window,
      type: "resize",
      mapEvent: () => Message.ChangedViewport({ width: window.innerWidth }),
    }),
  ),
  scrolling: Subscription.persistentEntry(
    Dom.streamFromEventFilterMap({
      target: () => document,
      type: "scroll",
      options: { capture: true },
      filterMapEvent: gridScroll,
    }),
  ),
  beforePrint: Subscription.persistentEntry(
    Dom.streamFromEvent({
      target: () => window,
      type: "beforeprint",
      mapEvent: () => Message.ChangedPrint({ printing: true }),
    }),
  ),
  afterPrint: Subscription.persistentEntry(
    Dom.streamFromEvent({
      target: () => window,
      type: "afterprint",
      mapEvent: () => Message.ChangedPrint({ printing: false }),
    }),
  ),
  systemTheme: Subscription.persistentEntry(
    Dom.streamFromEvent({
      target: () => window.matchMedia("(prefers-color-scheme: dark)"),
      type: "change",
      mapEvent: (event) => Message.ChangedSystemTheme({ dark: event.matches }),
    }),
  ),
  drag: Subscription.persistentEntry(
    Dom.streamFromEventFilterMap({
      target: () => document,
      type: "dragstart",
      filterMapEvent: (event) => {
        const target =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>("[data-event-key][draggable='true']")
            : null;
        const key = target?.getAttribute("data-event-key");
        if (!key) return Option.none();
        event.dataTransfer?.setData("application/x-julian-event", key);
        return Option.some(Message.StartedDrag({ key }));
      },
    }),
  ),
  dragOver: Subscription.persistentEntry(
    Dom.streamFromEventFilterMapPreventDefault({
      target: () => document,
      type: "dragover",
      filterMapEvent: (event) =>
        event.target instanceof Element &&
        event.target.closest("[data-year-grid-root]") &&
        event.dataTransfer?.types.includes("application/x-julian-event")
          ? Option.some(Message.Completed())
          : Option.none(),
    }),
  ),
  drop: Subscription.persistentEntry(
    Dom.streamFromEventFilterMapPreventDefault({
      target: () => document,
      type: "drop",
      filterMapEvent: (event) => {
        const column =
          event.target instanceof Element
            ? event.target.closest<HTMLElement>("[data-month-column]")
            : null;
        const root = column?.closest<HTMLElement>("[data-year-grid-root]");
        if (!column || !root || !event.dataTransfer?.types.includes("application/x-julian-event"))
          return Option.none();
        const year = Number(root.dataset.year);
        const month = Number(column.dataset.monthColumn);
        const day = Math.floor((event.clientY - column.getBoundingClientRect().top) / 30) + 1;
        if (day < 1 || day > new Date(year, month + 1, 0).getDate()) return Option.none();
        return Option.some(
          Message.DroppedEvent({ date: toDateInputValue(new Date(year, month, day)) }),
        );
      },
    }),
  ),
}));
