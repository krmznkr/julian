import { Option } from "effect";
import { type Update } from "foldkit";
import { UrlRequest } from "foldkit/navigation";
import { toString as urlToString, type Url } from "foldkit/url";
import {
  addDays,
  buildTimelineRows,
  getDefaultWritableCalendar,
  moveAllDayDates,
  parseDateInput,
  shiftTimelineWindow,
  TIMELINE_ZOOMS,
  toDateInputValue,
} from "@julian/domain";
import {
  adjacentTimelineBar,
  stepZoom,
  windowStartIndex,
} from "@/components/year-view/timeline-layout";
import {
  clampCell,
  daysInMonth,
  digitFromKeyboardCode,
  resolveArrowMoveStep,
  resolveDayTypeaheadInput,
} from "@/components/year-view/year-grid-keyboard";
import { parseYearParam } from "@/lib/year-view-url";
import { nextThemeMode } from "@/lib/theme";
import {
  Boot,
  Auth,
  DigitTimeout,
  Focus,
  LoadYear,
  MoveEvent,
  MutateEvent,
  Navigate,
  OpenExternal,
  Overlay,
  PersistSelection,
  Preference,
  RevealDate,
  RevealTimeline,
  SaveSidebar,
  TourTick,
} from "./commands";
import { CalendarPorts } from "./services";
import {
  Message,
  canModify,
  eventKey,
  eventsForDate,
  initialModel,
  isPending,
  selectedEvent,
  visibleEvents,
  type Dialog,
  type Model,
} from "./model";
import { calendarHref, resolveRoute } from "./routing";

export type Result = Update.Return<Model, Message, CalendarPorts>;
const cellFor = (date: string) => ({
  month: Number(date.slice(5, 7)) - 1,
  day: Number(date.slice(8, 10)),
});
const loadYear = (model: Model, reset = false): Result => ({
  model: { ...model, loading: true, error: null, loadId: model.loadId + 1 },
  commands: [
    LoadYear({ year: model.year, id: model.loadId + 1, demo: model.page === "demo", reset }),
  ],
});
const overlay = (model: Model, dialog: Dialog, focus?: string): Result => ({
  model: { ...model, dialog, busy: false, dialogError: null, commandQuery: "" },
  commands: [
    Overlay({
      kind: dialog,
      focus:
        focus ??
        (dialog === "none"
          ? "#year-application"
          : dialog === "create" || dialog === "edit"
            ? "#event-title"
            : dialog === "move"
              ? "#move-date"
              : dialog === "delete"
                ? "#confirm-delete"
                : dialog === "commands"
                  ? "#command-search"
                  : dialog === "calendars"
                    ? "#drawer-connect"
                    : "#dialog-close"),
    }),
    ...(dialog === "none" && model.details ? [RevealDate({ date: model.date, focus: false })] : []),
  ],
});
const navigateTo = (
  model: Model,
  date: string,
  details = model.details,
  replace = true,
  mode = model.mode,
): Result => {
  const year = Number(date.slice(0, 4));
  if (year < 1970 || year > 2100) return { model };
  const changedYear = year !== model.year;
  const cell = cellFor(date);
  const next: Model = {
    ...model,
    year,
    date,
    details,
    mode,
    yearInput: String(year),
    digits: "",
    selectedKey: details ? model.selectedKey : null,
    firstMonth: Math.max(0, cell.month - (model.width < 768 ? 1 : 3)),
    lastMonth: Math.min(11, cell.month + (model.width < 768 ? 1 : 3)),
    ...(changedYear ? { events: [], hydrated: false, selectedKey: null } : {}),
    timelineStart: windowStartIndex(model.zoom, parseDateInput(date), year),
  };
  const pending = changedYear ? loadYear(next) : { model: next, commands: [] };
  const selected = details
    ? (eventsForDate(pending.model).find(
        (event) => eventKey(event) === pending.model.selectedKey,
      ) ?? eventsForDate(pending.model)[0])
    : undefined;
  return {
    model: { ...pending.model, selectedKey: selected ? eventKey(selected) : null },
    commands: [
      ...(pending.commands ?? []),
      Navigate({ href: calendarHref(next), replace, external: false }),
      ...(mode === "grid"
        ? [RevealDate({ date, focus: true })]
        : [RevealTimeline({ index: next.timelineStart, focus: true })]),
    ],
  };
};

const enterRoute = (model: Model, href: string, connected: boolean): Result => {
  const route = resolveRoute(href, model.today, connected);
  const changed = route.year !== model.year || route.page !== model.page;
  const next: Model = {
    ...model,
    ...route,
    href: route.page === "callback" ? "/auth/callback" : href,
    yearInput: String(route.year),
    firstMonth: Math.max(0, cellFor(route.date).month - (model.width < 768 ? 1 : 3)),
    lastMonth: Math.min(11, cellFor(route.date).month + (model.width < 768 ? 1 : 3)),
    timelineStart: windowStartIndex(model.zoom, parseDateInput(route.date), route.year),
    ...(changed
      ? { selectedKey: null, dialog: "none", query: "", events: [], hydrated: false }
      : {}),
  };
  if (route.page === "callback")
    return {
      model: next,
      commands: model.page === "callback" ? [] : [Auth({ operation: "callback" })],
    };
  if (route.page !== "calendar" && route.page !== "demo")
    return {
      model: { ...next, loading: false },
      commands:
        route.page === "signed-out" &&
        new URL(href, "https://julian.invalid").pathname !== `/${route.year}`
          ? [Navigate({ href: calendarHref(next), replace: true, external: false })]
          : [],
    };
  const loaded = changed || !model.hydrated ? loadYear(next) : { model: next, commands: [] };
  const selected = route.details
    ? (eventsForDate(loaded.model).find((event) => eventKey(event) === model.selectedKey) ??
      eventsForDate(loaded.model)[0])
    : undefined;
  const url = new URL(href, "https://julian.invalid");
  const canonical = `${route.page === "demo" ? "/demo" : ""}/${route.year}`;
  return {
    model: { ...loaded.model, selectedKey: selected ? eventKey(selected) : null },
    commands: [
      ...(loaded.commands ?? []),
      ...(url.pathname !== canonical ||
      (!url.searchParams.has("month") && !url.searchParams.has("day"))
        ? [Navigate({ href: calendarHref(next), replace: true, external: false })]
        : []),
      ...(route.mode === "grid"
        ? [RevealDate({ date: route.date, focus: true })]
        : [RevealTimeline({ index: next.timelineStart, focus: true })]),
    ],
  };
};

export const init = (url: Url): Result => ({
  model: initialModel(url.pathname === "/auth/callback" ? url.pathname : urlToString(url)),
  commands: [Boot()],
});

const moveEvent = (model: Model, key: string, date: string): Result => {
  const before = model.events.find((event) => eventKey(event) === key);
  if (!before || !before.allDay || !canModify(model, before) || isPending(model, before))
    return { model };
  const target = parseDateInput(date);
  if (
    !Number.isFinite(target.getTime()) ||
    target.getFullYear() < 1970 ||
    target.getFullYear() > 2100
  )
    return { model: { ...model, dialogError: "Choose a valid start date." } };
  const closed = model.dialog === "move" ? overlay(model, "none") : { model, commands: [] };
  if (before.start.slice(0, 10) === date) return closed;
  const dates = moveAllDayDates(before, date);
  const id = model.nextMoveId;
  return {
    model: {
      ...closed.model,
      events: model.events.map((event) =>
        eventKey(event) === key ? { ...event, ...dates } : event,
      ),
      nextMoveId: id + 1,
      pending: [...model.pending, { id, year: model.year, before, ...dates }],
      error: null,
      failNextMove: false,
      status: `Saving ${before.title}…`,
    },
    commands: [
      ...(closed.commands ?? []),
      MoveEvent({ id, before, date, demo: model.page === "demo", fail: model.failNextMove }),
    ],
  };
};

const startMutation = (model: Model): Result => {
  if (model.busy) return { model };
  const event = selectedEvent(model) ?? null;
  if (model.dialog === "move")
    return event ? moveEvent(model, eventKey(event), model.moveDate) : { model };
  if (model.dialog !== "create" && model.dialog !== "edit" && model.dialog !== "delete")
    return { model };
  const calendar = getDefaultWritableCalendar(model.calendars);
  if (model.dialog !== "create" && (!event || !canModify(model, event))) return { model };
  if (model.dialog === "create" && !calendar)
    return {
      model: { ...model, dialogError: "Connect a writable Google calendar to create events." },
    };
  const title = model.titleInput.trim();
  if (model.dialog !== "delete" && !title)
    return { model: { ...model, dialogError: "Enter an event title." } };
  return {
    model: { ...model, busy: true, dialogError: null },
    commands: [
      MutateEvent({
        year: model.year,
        demo: model.page === "demo",
        operation: model.dialog,
        event,
        calendar,
        title,
        date: model.date,
      }),
    ],
  };
};

const action = (model: Model, name: string): Result => {
  const event = selectedEvent(model);
  switch (name) {
    case "today":
      return navigateTo(model, model.today, false, false);
    case "previous-year":
    case "next-year": {
      const year = model.year + (name === "next-year" ? 1 : -1);
      const cell = clampCell(cellFor(model.date), year);
      return navigateTo(
        model,
        toDateInputValue(new Date(year, cell.month, cell.day)),
        false,
        false,
      );
    }
    case "refresh":
      return loadYear(model);
    case "reset-demo":
      return model.page === "demo"
        ? loadYear(
            { ...model, query: "", details: false, selectedKey: null, tourRunning: false },
            true,
          )
        : { model };
    case "sidebar":
      return model.width < 768
        ? overlay(model, model.dialog === "calendars" ? "none" : "calendars")
        : {
            model: { ...model, sidebarCollapsed: !model.sidebarCollapsed },
            commands: [
              SaveSidebar({ demo: model.page === "demo", collapsed: !model.sidebarCollapsed }),
            ],
          };
    case "calendars":
      return overlay(model, "calendars");
    case "close-dialog":
      return model.busy
        ? { model }
        : overlay(model, "none", model.dialog === "calendars" ? "none" : undefined);
    case "create":
      return overlay({ ...model, titleInput: "" }, "create");
    case "edit":
      return event && canModify(model, event)
        ? overlay({ ...model, titleInput: event.title }, "edit")
        : { model };
    case "move":
      return event?.allDay && canModify(model, event)
        ? overlay({ ...model, moveDate: event.start.slice(0, 10) }, "move")
        : { model };
    case "delete":
      return event && canModify(model, event) ? overlay(model, "delete") : { model };
    case "submit":
      return startMutation(model);
    case "help":
    case "commands":
    case "settings":
      return overlay(model, name);
    case "clear-search":
      return {
        model: { ...model, query: "" },
        commands: [Focus({ selector: "#year-application" })],
      };
    case "theme": {
      const theme = nextThemeMode(model.theme);
      return { model: { ...model, theme }, commands: [Preference({ key: "theme", value: theme })] };
    }
    case "connect":
      return {
        model: { ...model, connecting: true, error: null },
        commands: [Auth({ operation: "connect" })],
      };
    case "logout":
      return { model, commands: [Auth({ operation: "logout" })] };
    case "dismiss-error":
      return { model: { ...model, error: null } };
    case "fail-next":
      return { model: { ...model, failNextMove: !model.failNextMove } };
    case "open-day":
      return {
        model,
        commands: [
          OpenExternal({
            href: `https://calendar.google.com/calendar/u/0/r/day/${model.year}/${Number(model.date.slice(5, 7))}/${Number(model.date.slice(8, 10))}`,
          }),
        ],
      };
    case "open-event":
      return event?.htmlLink
        ? { model, commands: [OpenExternal({ href: event.htmlLink })] }
        : event?.calendarId === "__google_tasks__"
          ? action(model, "open-day")
          : { model };
    case "previous-window":
    case "next-window":
      return navigateTo(
        model,
        toDateInputValue(
          shiftTimelineWindow(
            model.zoom,
            parseDateInput(model.date),
            name === "next-window" ? 1 : -1,
          ),
        ),
        false,
      );
    case "tour":
      return model.tourRunning
        ? { model: { ...model, tourRunning: false, tour: 0 } }
        : {
            model: { ...model, tourRunning: true },
            commands: [TourTick({ step: 1, millis: 300 })],
          };
    default:
      return { model };
  }
};

const pressedKey = (model: Model, message: Extract<Message, { _tag: "PressedKey" }>): Result => {
  const { key, code, shift, alt, mod, area } = message;
  const lower = key.toLowerCase();
  if (area === "search") return key === "Escape" ? action(model, "clear-search") : { model };
  if (area === "input") return key === "Escape" ? action(model, "close-dialog") : { model };
  if (key === "/")
    return { ...overlay(model, "none", "#event-search"), model: { ...model, dialog: "none" } };
  if (mod && lower === "k") return action(model, "commands");
  if (model.dialog !== "none") return key === "Escape" ? action(model, "close-dialog") : { model };
  if (key === "Escape") return navigateTo(model, model.date, false);
  if (key === "?") return action(model, "help");
  if (lower === "s") return action(model, "sidebar");
  if (lower === "t") return action(model, shift ? "theme" : "today");
  if (lower === "r") return action(model, "refresh");
  if (lower === "v")
    return navigateTo(model, model.date, false, true, model.mode === "grid" ? "timeline" : "grid");
  if (lower === "n") return action(model, "create");
  if (lower === "e") return action(model, "edit");
  if (lower === "m") return action(model, "move");
  if (mod && key === "Backspace") return action(model, "delete");
  if (area === "sidebar" || area === "toolbar") return { model };
  if (model.mode === "timeline") {
    if (key === "+" || key === "=" || key === "-")
      return update(
        model,
        Message.ChangedZoom({ zoom: stepZoom(TIMELINE_ZOOMS, model.zoom, key === "-" ? 1 : -1) }),
      );
    if (key === "[" || key === "]")
      return action(model, key === "[" ? "previous-window" : "next-window");
    if (key.startsWith("Arrow") && model.timelineKey) {
      const rows = buildTimelineRows(visibleEvents(model), model.selectedCalendarIds, model.year);
      const next = adjacentTimelineBar(
        rows,
        model.timelineKey,
        key.slice(5).toLowerCase() as "left" | "right" | "up" | "down",
      );
      return next
        ? {
            model: { ...model, timelineKey: next, selectedKey: next },
            commands: [Focus({ selector: `[data-timeline-key="${next}"]` })],
          }
        : { model };
    }
  }
  if (key === "Enter")
    return shift
      ? action(model, "open-day")
      : model.details
        ? action(model, "open-event")
        : navigateTo(model, model.date, true);
  if (key === " ") return navigateTo(model, model.date, !model.details);
  if (
    model.details &&
    ["ArrowUp", "ArrowDown", "[", "]", "ArrowLeft", "ArrowRight"].includes(key)
  ) {
    const events = eventsForDate(model);
    const index = events.findIndex((event) => eventKey(event) === model.selectedKey);
    const next =
      events[
        Math.max(
          0,
          Math.min(
            events.length - 1,
            index + (["ArrowUp", "ArrowLeft", "["].includes(key) ? -1 : 1),
          ),
        )
      ];
    return next ? { model: { ...model, selectedKey: eventKey(next) } } : { model };
  }
  const cell = cellFor(model.date);
  const step = resolveArrowMoveStep({ key, shiftKey: shift, altKey: alt });
  if (step) {
    const year = model.year + step.yearDelta;
    const target = step.verticalDays
      ? addDays(parseDateInput(model.date), step.verticalDays)
      : new Date(
          year,
          Math.max(0, Math.min(11, cell.month + step.horizontalMonths)),
          Math.min(
            cell.day,
            daysInMonth(year, Math.max(0, Math.min(11, cell.month + step.horizontalMonths))),
          ),
        );
    return navigateTo(model, toDateInputValue(target), false, step.yearDelta === 0);
  }
  if (key === "Home" || key === "End")
    return navigateTo(
      model,
      toDateInputValue(
        new Date(model.year, cell.month, key === "Home" ? 1 : daysInMonth(model.year, cell.month)),
      ),
      false,
    );
  if (key === "PageUp" || key === "PageDown")
    return navigateTo(
      model,
      toDateInputValue(addDays(parseDateInput(model.date), key === "PageUp" ? -7 : 7)),
      false,
    );
  const digit = shift ? digitFromKeyboardCode(code) : /^\d$/.test(key) ? key : null;
  if (digit !== null) {
    const kind = shift ? "month" : "day";
    const result = resolveDayTypeaheadInput({
      key: digit,
      buffer: model.digitKind === kind ? model.digits : "",
      maxDay: shift ? 12 : daysInMonth(model.year, cell.month),
    });
    if (!result) return { model };
    const base = {
      ...model,
      digits: result.nextBuffer,
      digitKind: kind,
      digitId: model.digitId + 1,
    };
    const target =
      result.commitDay === null
        ? { model: base, commands: [] }
        : navigateTo(
            base,
            toDateInputValue(
              new Date(
                model.year,
                shift ? result.commitDay - 1 : cell.month,
                shift
                  ? Math.min(cell.day, daysInMonth(model.year, result.commitDay - 1))
                  : result.commitDay,
              ),
            ),
            false,
          );
    return {
      model: { ...target.model, digits: result.nextBuffer, digitKind: kind, digitId: base.digitId },
      commands: [...(target.commands ?? []), DigitTimeout({ id: base.digitId })],
    };
  }
  return { model };
};

export const update = (model: Model, message: Message): Result =>
  Message.match<Result>(message, {
    Booted: ({
      today,
      connected,
      width,
      theme,
      sidebarCollapsed,
      fontSize,
      density,
      platform,
      reducedMotion,
    }) => {
      const entered = enterRoute(
        {
          ...model,
          today,
          width,
          theme,
          sidebarCollapsed,
          fontSize,
          density,
          platform,
          reducedMotion,
        },
        model.href,
        connected,
      );
      const autoplay = entered.model.page === "demo" && width >= 1024 && !reducedMotion;
      return {
        model: {
          ...entered.model,
          sidebarCollapsed: entered.model.page === "demo" ? false : entered.model.sidebarCollapsed,
          tourRunning: autoplay,
        },
        commands: [
          ...(entered.commands ?? []),
          Preference({ key: "theme", value: theme }),
          ...(autoplay ? [TourTick({ step: 1, millis: 300 })] : []),
        ],
      };
    },
    ChangedUrl: ({ url }) => enterRoute(model, urlToString(url), model.page === "calendar"),
    ClickedLink: ({ request }) =>
      UrlRequest.match<Result>(request, {
        Internal: ({ url }) =>
          Option.getOrNull(url.hash) === "main-content"
            ? { model, commands: [Focus({ selector: "#main-content" })] }
            : {
                model,
                commands: [
                  Navigate({
                    href: urlToString(url),
                    replace: false,
                    external: ["/home", "/privacy", "/terms"].includes(url.pathname),
                  }),
                ],
              },
        External: ({ href }) => ({
          model,
          commands: [Navigate({ href, replace: false, external: true })],
        }),
      }),
    SucceededLoad: ({ id, year, calendars, events, selectedCalendarIds, failures }) => {
      if (id !== model.loadId || year !== model.year) return { model };
      const merged = events.map((event) => {
        const pending = model.pending.find(
          (move) => move.year === year && eventKey(move.before) === eventKey(event),
        );
        return pending ? { ...event, start: pending.start, end: pending.end } : event;
      });
      const next = {
        ...model,
        calendars,
        events: merged,
        selectedCalendarIds,
        failures,
        loading: false,
        hydrated: true,
        error: null,
        status: failures.length ? "Some calendars could not be loaded." : "Calendar loaded.",
      };
      const selected = model.details
        ? (eventsForDate(next).find((event) => eventKey(event) === model.selectedKey) ??
          eventsForDate(next)[0])
        : undefined;
      return {
        model: { ...next, selectedKey: selected ? eventKey(selected) : null },
        commands: model.mode === "grid" ? [RevealDate({ date: model.date, focus: true })] : [],
      };
    },
    FailedLoad: ({ id, year, error }) =>
      id === model.loadId && year === model.year
        ? { model: { ...model, loading: false, hydrated: true, error } }
        : { model },
    ClickedAction: ({ action: name }) => {
      const base = name === "tour" ? model : { ...model, tourRunning: false };
      if (model.dialog === "commands" && ["today", "refresh", "sidebar"].includes(name)) {
        const closed = overlay(base, "none");
        const result = action(closed.model, name);
        return { ...result, commands: [...(closed.commands ?? []), ...(result.commands ?? [])] };
      }
      return action(base, name);
    },
    ChangedField: ({ field, value }) => ({ model: { ...model, [field]: value } }),
    SubmittedYear: () => {
      const year = parseYearParam(model.yearInput);
      const cell = year === null ? null : clampCell(cellFor(model.date), year);
      return year !== null && cell
        ? navigateTo(model, toDateInputValue(new Date(year, cell.month, cell.day)), false, false)
        : { model: { ...model, yearInput: String(model.year) } };
    },
    ClickedDate: ({ date }) => navigateTo(model, date, true),
    ClickedEvent: ({ key }) => {
      const event = model.events.find((item) => eventKey(item) === key);
      if (!event) return { model };
      const date =
        event.start.slice(0, 10).slice(0, 4) === String(model.year)
          ? event.start.slice(0, 10)
          : `${model.year}-01-01`;
      const result = navigateTo({ ...model, selectedKey: key, timelineKey: key }, date, true);
      return { ...result, model: { ...result.model, selectedKey: key, timelineKey: key } };
    },
    SelectedEvent: ({ key }) => ({ model: { ...model, selectedKey: key, timelineKey: key } }),
    ClickedCalendar: ({ id }) => {
      const selected = model.selectedCalendarIds.includes(id)
        ? model.selectedCalendarIds.filter((item) => item !== id)
        : [...model.selectedCalendarIds, id];
      return {
        model: { ...model, selectedCalendarIds: selected },
        commands: [
          PersistSelection({
            demo: model.page === "demo",
            available: model.calendars.map((calendar) => calendar.id),
            selected,
          }),
        ],
      };
    },
    ChangedMode: ({ mode }) => navigateTo(model, model.date, false, true, mode),
    ChangedZoom: ({ zoom }) => ({
      model: {
        ...model,
        zoom,
        timelineStart: windowStartIndex(zoom, parseDateInput(model.date), model.year),
      },
      commands: [
        RevealTimeline({
          index: windowStartIndex(zoom, parseDateInput(model.date), model.year),
          focus: false,
        }),
      ],
    }),
    ChangedSetting: ({ field, value }) => ({
      model: { ...model, [field]: value },
      commands: [Preference({ key: `julian.settings.${field}`, value })],
    }),
    PressedKey: (key) => pressedKey({ ...model, tourRunning: false }, key),
    ElapsedDigits: ({ id }) => {
      if (id !== model.digitId || !model.digits) return { model };
      const cell = cellFor(model.date);
      const value = Number(model.digits);
      return navigateTo(
        model,
        toDateInputValue(
          new Date(
            model.year,
            model.digitKind === "month" ? value - 1 : cell.month,
            model.digitKind === "month"
              ? Math.min(cell.day, daysInMonth(model.year, value - 1))
              : value,
          ),
        ),
        false,
      );
    },
    SucceededMutation: ({ year, operation, event, title }) => {
      if (year !== model.year || !event) return { model };
      const closed = overlay(model, "none");
      const events =
        operation === "create"
          ? [...model.events, event]
          : operation === "delete"
            ? model.events.filter((item) => eventKey(item) !== eventKey(event))
            : model.events.map((item) =>
                eventKey(item) === eventKey(event) ? { ...item, title } : item,
              );
      return {
        ...closed,
        model: {
          ...closed.model,
          events,
          selectedKey: operation === "delete" ? null : eventKey(event),
          status: operation === "delete" ? "Event deleted." : "Event saved.",
        },
      };
    },
    FailedMutation: ({ year, error }) =>
      year === model.year ? { model: { ...model, busy: false, dialogError: error } } : { model },
    SucceededMove: ({ id }) => ({
      model: {
        ...model,
        pending: model.pending.filter((move) => move.id !== id),
        status: "Event moved.",
      },
    }),
    FailedMove: ({ id, error }) => {
      const pending = model.pending.find((move) => move.id === id);
      return pending
        ? {
            model: {
              ...model,
              pending: model.pending.filter((move) => move.id !== id),
              events:
                pending.year === model.year
                  ? model.events.map((event) =>
                      eventKey(event) === eventKey(pending.before)
                        ? { ...event, start: pending.before.start, end: pending.before.end }
                        : event,
                    )
                  : model.events,
              error: `Could not move ${pending.before.title}. ${error} Original dates restored.`,
              status: "Move rolled back.",
            },
          }
        : { model };
    },
    StartedDrag: ({ key }) => ({ model: { ...model, dragKey: key } }),
    DroppedEvent: ({ date }) =>
      model.dragKey ? moveEvent({ ...model, dragKey: null }, model.dragKey, date) : { model },
    EndedDrag: () => ({ model: { ...model, dragKey: null } }),
    ChangedViewport: ({ width }) =>
      width >= 768 && model.dialog === "calendars"
        ? overlay({ ...model, width }, "none")
        : { model: { ...model, width } },
    ScrolledGrid: ({ first, last }) => ({
      model:
        first === model.firstMonth && last === model.lastMonth
          ? model
          : { ...model, firstMonth: first, lastMonth: last },
    }),
    ChangedPrint: ({ printing }) => ({ model: { ...model, printing } }),
    ChangedSystemTheme: () =>
      model.theme === "system"
        ? { model, commands: [Preference({ key: "theme", value: "system" })] }
        : { model },
    SucceededAuth: () =>
      model.page === "callback"
        ? {
            model: { ...model, status: "Connected to Google." },
            commands: [
              Navigate({ href: `/${model.today.slice(0, 4)}`, replace: true, external: true }),
            ],
          }
        : { model },
    FailedAuth: ({ error }) => ({ model: { ...model, error, connecting: false, loading: false } }),
    LoggedOut: () => ({
      model: { ...model, page: "signed-out", events: [], calendars: [], pending: [] },
      commands: [Navigate({ href: "/", replace: true, external: true })],
    }),
    AdvancedTour: ({ step }) => {
      if (!model.tourRunning || model.page !== "demo") return { model };
      if (step === 1) {
        const next = navigateTo({ ...model, tour: 1 }, model.today, true);
        return {
          ...next,
          commands: [...(next.commands ?? []), TourTick({ step: 2, millis: 4000 })],
        };
      }
      if (step === 2) {
        const next = overlay({ ...model, tour: 2, titleInput: "Dinner with friends" }, "create");
        return {
          ...next,
          commands: [...(next.commands ?? []), TourTick({ step: 20, millis: 1500 })],
        };
      }
      if (step === 20) {
        const next = startMutation(model);
        return {
          ...next,
          commands: [...(next.commands ?? []), TourTick({ step: 3, millis: 2000 })],
        };
      }
      if (step === 3) {
        const next = overlay({ ...model, tour: 3 }, "commands");
        return {
          ...next,
          commands: [...(next.commands ?? []), TourTick({ step: 4, millis: 3500 })],
        };
      }
      return overlay({ ...model, tour: 0, tourRunning: false }, "none");
    },
    Completed: () => ({ model }),
  });
