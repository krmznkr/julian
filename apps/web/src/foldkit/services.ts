import { Context, Effect, Layer, Ref, Schema } from "effect";
import { GoogleAuth } from "@julian/google/google-auth";
import { Navigation } from "@julian/google/navigation";
import {
  addDays,
  isWritableCalendar,
  parseDateInput,
  toDateInputValue,
  type CalendarEvent,
} from "@julian/domain";
import { buildDemoYear } from "@/demo/demo-data";
import { makeGoogleDataSource, makeGoogleEventApi } from "@/year-view/google-ports";
import type { YearViewDataSource, YearViewEventApi } from "@/year-view/year-view-ports";
import { provideApp } from "@/lib/effect/runtime";
import { clearSessionHint, hasStoredGoogleSession, markSessionHint } from "@/lib/session";
import {
  getStoredSidebarCollapsedPreference,
  storeSidebarCollapsedPreference,
} from "@/lib/year-view-preferences";
import type { Model } from "./model";

// oxlint-disable-next-line functional/no-classes -- Effect tagged errors require a class.
export class CalendarFailure extends Schema.TaggedError<CalendarFailure>()("CalendarFailure", {
  message: Schema.String,
}) {}

export type BootInfo = Pick<
  Model,
  | "today"
  | "width"
  | "theme"
  | "sidebarCollapsed"
  | "fontSize"
  | "density"
  | "platform"
  | "reducedMotion"
> & { readonly connected: boolean };
export type PortsShape = {
  readonly boot: Effect.Effect<BootInfo>;
  readonly source: (demo: boolean) => YearViewDataSource;
  readonly api: (demo: boolean) => YearViewEventApi;
  readonly resetDemo: Effect.Effect<void>;
  readonly connect: Effect.Effect<void, { readonly message: string }>;
  readonly callback: Effect.Effect<void, { readonly message: string }>;
  readonly logout: Effect.Effect<void, { readonly message: string }>;
  readonly external: (url: string) => Effect.Effect<void>;
  readonly preference: (key: string, value: string) => Effect.Effect<void>;
  readonly sidebar: (demo: boolean, collapsed: boolean) => Effect.Effect<void>;
};
// oxlint-disable-next-line functional/no-classes -- Effect service keys require a class.
export class CalendarPorts extends Context.Service<CalendarPorts, PortsShape>()(
  "@julian/foldkit/CalendarPorts",
) {}

const safeRead = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

export const browserPortsLayer = Layer.effect(
  CalendarPorts,
  Effect.gen(function* () {
    const today = yield* Effect.sync(() => new Date());
    const store = yield* Ref.make<Readonly<Record<number, readonly CalendarEvent[]>>>({});
    const hidden = yield* Ref.make<readonly string[]>([]);
    const nextId = yield* Ref.make(0);
    const source: YearViewDataSource = {
      load: (year) =>
        Effect.gen(function* () {
          const all = yield* Ref.get(store);
          const seed = buildDemoYear(year, today);
          const events = all[year] ?? seed.events;
          if (!all[year]) yield* Ref.update(store, (current) => ({ ...current, [year]: events }));
          const excluded = yield* Ref.get(hidden);
          return {
            calendars: seed.calendars,
            events,
            failures: [],
            selectedCalendarIds: seed.calendars
              .map((calendar) => calendar.id)
              .filter((id) => !excluded.includes(id)),
          };
        }),
      persistSelection: (available, selected) =>
        Effect.runSync(
          Ref.set(
            hidden,
            available.filter((id) => !selected.includes(id)),
          ),
        ),
    };
    const change = (
      calendarId: string,
      eventId: string,
      transform: (event: CalendarEvent) => CalendarEvent | null,
    ) =>
      Effect.gen(function* () {
        const calendar = buildDemoYear(today.getFullYear(), today).calendars.find(
          (item) => item.id === calendarId,
        );
        if (!isWritableCalendar(calendar))
          return yield* Effect.fail(
            new CalendarFailure({ message: "This calendar is read-only." }),
          );
        const years = yield* Ref.get(store);
        if (
          !Object.values(years).some((events) =>
            events.some((event) => event.id === eventId && event.calendarId === calendarId),
          )
        )
          return yield* Effect.fail(
            new CalendarFailure({ message: "The event no longer exists." }),
          );
        yield* Ref.update(store, (current) =>
          Object.fromEntries(
            Object.entries(current).map(([year, events]) => [
              year,
              events.flatMap((event) => {
                const next =
                  event.id === eventId && event.calendarId === calendarId
                    ? transform(event)
                    : event;
                return next ? [next] : [];
              }),
            ]),
          ),
        );
      });
    const api: YearViewEventApi = {
      createEvent: (calendar, input) =>
        Effect.gen(function* () {
          const id = yield* Ref.getAndUpdate(nextId, (value) => value + 1);
          const year = Number(input.date.slice(0, 4));
          const existing = yield* source.load(year);
          const event: CalendarEvent = {
            id: `demo-local-${id}`,
            calendarId: calendar.id,
            calendarSummary: calendar.summary,
            calendarColor: calendar.backgroundColor,
            title: input.title,
            start: input.date,
            end: toDateInputValue(addDays(parseDateInput(input.date), 1)),
            allDay: true,
            isTimed: false,
          };
          yield* Ref.update(store, (current) => ({
            ...current,
            [year]: [...existing.events, event],
          }));
          return event;
        }),
      updateEvent: (calendar, id, input) =>
        change(calendar, id, (event) => ({ ...event, title: input.title })),
      moveEvent: (calendar, id, dates) =>
        change(calendar, id, (event) => (event.allDay ? { ...event, ...dates } : event)),
      deleteEvent: (calendar, id) => change(calendar, id, () => null),
    };
    const googleSource = makeGoogleDataSource(provideApp);
    const googleApi = makeGoogleEventApi(provideApp);
    return CalendarPorts.of({
      boot: Effect.sync(() => {
        const theme = safeRead("theme", "system");
        return {
          today: toDateInputValue(today),
          connected: hasStoredGoogleSession(),
          width: window.innerWidth,
          theme: theme === "light" || theme === "dark" ? theme : "system",
          sidebarCollapsed: getStoredSidebarCollapsedPreference(),
          fontSize: safeRead("julian.settings.fontSize", "medium"),
          density: safeRead("julian.settings.density", "comfortable"),
          platform: navigator.platform,
          reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        };
      }),
      source: (demo) => (demo ? source : googleSource),
      api: (demo) => (demo ? api : googleApi),
      resetDemo: Effect.all([Ref.set(store, {}), Ref.set(hidden, []), Ref.set(nextId, 0)]).pipe(
        Effect.asVoid,
      ),
      connect: provideApp(Effect.flatMap(GoogleAuth, (auth) => auth.start)),
      callback: Effect.gen(function* () {
        const code = yield* Effect.sync(() =>
          new URLSearchParams(window.location.search).get("code"),
        );
        if (!code)
          return yield* Effect.fail(
            new CalendarFailure({ message: "No authorization code received." }),
          );
        yield* provideApp(Effect.flatMap(GoogleAuth, (auth) => auth.handleCallback(code)));
        yield* Effect.sync(markSessionHint);
      }),
      logout: provideApp(Effect.flatMap(GoogleAuth, (auth) => auth.logout)).pipe(
        Effect.ensuring(Effect.sync(clearSessionHint)),
      ),
      external: (url) =>
        provideApp(Effect.flatMap(Navigation, (navigation) => navigation.openExternal(url))).pipe(
          Effect.ignore,
        ),
      sidebar: (demo, collapsed) =>
        demo ? Effect.void : Effect.sync(() => storeSidebarCollapsedPreference(collapsed)),
      preference: (key, value) =>
        Effect.sync(() => {
          try {
            localStorage.setItem(key, value);
          } catch {
            /* Preferences remain usable when storage is blocked. */
          }
          if (key === "theme") {
            const dark =
              value === "dark" ||
              (value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
            document.documentElement.classList.toggle("dark", dark);
            document.documentElement.classList.toggle("light", !dark);
            document.documentElement.style.setProperty("color-scheme", dark ? "dark" : "light");
          } else {
            document.documentElement.setAttribute(
              key.endsWith("fontSize") ? "data-font-size" : "data-density",
              value,
            );
          }
        }),
    });
  }),
);
