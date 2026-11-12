import { Effect, Schema } from "effect";
import { Command, Dom, Render } from "foldkit";
import { load, pushUrl, replaceUrl } from "foldkit/navigation";
import { moveAllDayDates } from "@julian/domain";
import { CalendarPorts, CalendarFailure } from "./services";
import { Calendar, Event, Message } from "./model";

export const Boot = Command.define("Boot", {
  messages: [Message.Booted],
  execute: Effect.flatMap(CalendarPorts, (ports) => ports.boot).pipe(Effect.map(Message.Booted)),
});
export const Navigate = Command.define("Navigate", {
  args: { href: Schema.String, replace: Schema.Boolean, external: Schema.Boolean },
  messages: [Message.Completed],
  execute: ({ href, replace, external }) =>
    (external ? load(href) : replace ? replaceUrl(href) : pushUrl(href)).pipe(
      Effect.as(Message.Completed()),
    ),
});
export const LoadYear = Command.define("LoadYear", {
  args: { year: Schema.Number, id: Schema.Number, demo: Schema.Boolean, reset: Schema.Boolean },
  interrupt: true,
  messages: [Message.SucceededLoad, Message.FailedLoad],
  execute: ({ year, id, demo, reset }) =>
    Effect.gen(function* () {
      const ports = yield* CalendarPorts;
      if (reset && demo) yield* ports.resetDemo;
      const result = yield* ports.source(demo).load(year);
      return Message.SucceededLoad({ ...result, year, id });
    }).pipe(
      Effect.catch((error) =>
        Effect.succeed(Message.FailedLoad({ year, id, error: error.message })),
      ),
    ),
});
export const MutateEvent = Command.define("MutateEvent", {
  args: {
    year: Schema.Number,
    demo: Schema.Boolean,
    operation: Schema.Literals(["create", "edit", "delete"]),
    event: Schema.NullOr(Event),
    calendar: Schema.NullOr(Calendar),
    title: Schema.String,
    date: Schema.String,
  },
  messages: [Message.SucceededMutation, Message.FailedMutation],
  execute: ({ year, demo, operation, event, calendar, title, date }) =>
    Effect.gen(function* () {
      const api = (yield* CalendarPorts).api(demo);
      if (operation === "create") {
        if (!calendar)
          return yield* Effect.fail(
            new CalendarFailure({ message: "Connect a writable calendar to create events." }),
          );
        const created = yield* api.createEvent(calendar, { title, date });
        return Message.SucceededMutation({ year, operation, event: created, key: null, title });
      }
      if (!event)
        return yield* Effect.fail(new CalendarFailure({ message: "Choose an event first." }));
      if (operation === "edit") yield* api.updateEvent(event.calendarId, event.id, { title });
      else yield* api.deleteEvent(event.calendarId, event.id);
      return Message.SucceededMutation({ year, operation, event, key: null, title });
    }).pipe(
      Effect.catch((error) =>
        Effect.succeed(Message.FailedMutation({ year, error: error.message })),
      ),
    ),
});
export const MoveEvent = Command.define("MoveEvent", {
  args: {
    id: Schema.Number,
    before: Event,
    date: Schema.String,
    demo: Schema.Boolean,
    fail: Schema.Boolean,
  },
  messages: [Message.SucceededMove, Message.FailedMove],
  execute: ({ id, before, date, demo, fail }) =>
    Effect.gen(function* () {
      const ports = yield* CalendarPorts;
      if (fail && demo) {
        yield* Effect.sleep("700 millis");
        return yield* Effect.fail(new CalendarFailure({ message: "Simulated save failure." }));
      }
      yield* ports.api(demo).moveEvent(before.calendarId, before.id, moveAllDayDates(before, date));
      return Message.SucceededMove({ id });
    }).pipe(
      Effect.catch((error) => Effect.succeed(Message.FailedMove({ id, error: error.message }))),
    ),
});
export const PersistSelection = Command.define("PersistSelection", {
  args: {
    demo: Schema.Boolean,
    available: Schema.Array(Schema.String),
    selected: Schema.Array(Schema.String),
  },
  messages: [Message.Completed],
  execute: ({ demo, available, selected }) =>
    Effect.flatMap(CalendarPorts, (ports) =>
      Effect.sync(() => ports.source(demo).persistSelection(available, selected)),
    ).pipe(Effect.as(Message.Completed())),
});
export const Preference = Command.define("Preference", {
  args: { key: Schema.String, value: Schema.String },
  messages: [Message.Completed],
  execute: ({ key, value }) =>
    Effect.flatMap(CalendarPorts, (ports) => ports.preference(key, value)).pipe(
      Effect.as(Message.Completed()),
    ),
});
export const SaveSidebar = Command.define("SaveSidebar", {
  args: { demo: Schema.Boolean, collapsed: Schema.Boolean },
  messages: [Message.Completed],
  execute: ({ demo, collapsed }) =>
    Effect.flatMap(CalendarPorts, (ports) => ports.sidebar(demo, collapsed)).pipe(
      Effect.as(Message.Completed()),
    ),
});
export const Focus = Command.define("Focus", {
  args: { selector: Schema.String },
  messages: [Message.Completed],
  execute: ({ selector }) =>
    Dom.focus(selector).pipe(Effect.ignore, Effect.as(Message.Completed())),
});
export const RevealTimeline = Command.define("RevealTimeline", {
  args: { index: Schema.Number, focus: Schema.Boolean },
  messages: [Message.Completed],
  execute: ({ index, focus }) =>
    (focus ? Dom.focus("#timeline-scroller", { preventScroll: true }) : Render.afterCommit).pipe(
      Effect.ignore,
      Effect.andThen(
        Effect.sync(() => {
          const root = document.getElementById("timeline-scroller");
          const track = root?.querySelector<HTMLElement>(".timeline-track");
          if (root && track)
            root.scrollTo({
              left: index * (Number.parseFloat(track.style.getPropertyValue("--day-width")) || 6),
              behavior: "instant",
            });
        }),
      ),
      Effect.as(Message.Completed()),
    ),
});
export const RevealDate = Command.define("RevealDate", {
  args: { date: Schema.String, focus: Schema.Boolean },
  messages: [Message.Completed],
  execute: ({ date, focus }) =>
    (focus ? Dom.focus("#year-application", { preventScroll: true }) : Render.afterCommit).pipe(
      Effect.ignore,
      Effect.andThen(
        Effect.sync(() => {
          const root = document.querySelector<HTMLElement>("[data-year-grid-root]");
          const cell = document.getElementById(
            `year-grid-cell-${date.slice(0, 4)}-${Number(date.slice(5, 7)) - 1}-${Number(date.slice(8, 10))}`,
          );
          const column = cell?.closest<HTMLElement>("[data-month-column]");
          const header = root?.querySelector<HTMLElement>("[data-year-grid-header]");
          if (!root || !cell || !column || !header) return;
          const gutter =
            root.querySelector<HTMLElement>(".year-grid-height.sticky")?.getBoundingClientRect()
              .width ?? 44;
          const area = root.getBoundingClientRect();
          const box = cell.getBoundingClientRect();
          const columnBox = column.getBoundingClientRect();
          const left =
            columnBox.left -
            area.left +
            root.scrollLeft -
            gutter -
            Math.max(0, (root.clientWidth - gutter - columnBox.width) / 2);
          const top =
            box.top < header.getBoundingClientRect().bottom
              ? root.scrollTop + box.top - header.getBoundingClientRect().bottom
              : box.bottom > area.top + root.clientHeight
                ? root.scrollTop + box.bottom - area.top - root.clientHeight + 4
                : root.scrollTop;
          root.scrollTo({ left: Math.max(0, left), top: Math.max(0, top), behavior: "instant" });
          const panel = document.getElementById("day-details");
          if (panel) {
            const nextBox = cell.getBoundingClientRect();
            const width = Math.min(340, window.innerWidth - 16);
            const panelLeft =
              nextBox.right + width + 6 <= window.innerWidth
                ? nextBox.right + 6
                : Math.max(8, nextBox.left - width - 6);
            panel.style.setProperty("left", `${panelLeft}px`);
            panel.style.setProperty(
              "top",
              `${Math.max(8, Math.min(nextBox.top, window.innerHeight - panel.offsetHeight - 8))}px`,
            );
          }
        }),
      ),
      Effect.as(Message.Completed()),
    ),
});
export const Overlay = Command.define("Overlay", {
  interrupt: true,
  args: { kind: Schema.String, focus: Schema.String },
  messages: [Message.Completed],
  execute: ({ kind, focus }) =>
    Dom.closeDialog("#app-dialog").pipe(
      Effect.ignore,
      Effect.andThen(
        kind === "none"
          ? focus === "none"
            ? Effect.void
            : Dom.focus(focus, { preventScroll: true }).pipe(Effect.ignore)
          : Dom.showDialog("#app-dialog", { isModal: true, focusSelector: focus }).pipe(
              Effect.ignore,
            ),
      ),
      Effect.as(Message.Completed()),
    ),
});
export const Auth = Command.define("Auth", {
  args: { operation: Schema.Literals(["connect", "callback", "logout"]) },
  messages: [Message.SucceededAuth, Message.FailedAuth, Message.LoggedOut],
  execute: ({ operation }) =>
    Effect.flatMap(
      CalendarPorts,
      (
        ports,
      ): Effect.Effect<
        Extract<Message, { readonly _tag: "LoggedOut" | "SucceededAuth" | "FailedAuth" }>,
        { readonly message: string }
      > =>
        operation === "logout"
          ? ports.logout.pipe(Effect.as(Message.LoggedOut()))
          : (operation === "callback" ? ports.callback : ports.connect).pipe(
              Effect.as(Message.SucceededAuth()),
            ),
    ).pipe(Effect.catch((error) => Effect.succeed(Message.FailedAuth({ error: error.message })))),
});
export const OpenExternal = Command.define("OpenExternal", {
  args: { href: Schema.String },
  messages: [Message.Completed],
  execute: ({ href }) =>
    Effect.flatMap(CalendarPorts, (ports) => ports.external(href)).pipe(
      Effect.as(Message.Completed()),
    ),
});
export const DigitTimeout = Command.define("DigitTimeout", {
  args: { id: Schema.Number },
  interrupt: true,
  messages: [Message.ElapsedDigits],
  execute: ({ id }) => Effect.sleep("450 millis").pipe(Effect.as(Message.ElapsedDigits({ id }))),
});
export const TourTick = Command.define("TourTick", {
  args: { step: Schema.Number, millis: Schema.Number },
  interrupt: true,
  messages: [Message.AdvancedTour],
  execute: ({ step, millis }) =>
    Effect.sleep(millis).pipe(Effect.as(Message.AdvancedTour({ step }))),
});
