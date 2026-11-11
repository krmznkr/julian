import { describe, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Fiber, Layer } from "effect";
import { TestClock } from "effect/testing";
import { Auth, Boot, LoadYear, MoveEvent, MutateEvent, OpenExternal, TourTick } from "./commands";
import { CalendarFailure, CalendarPorts, browserPortsLayer, type PortsShape } from "./services";

const event = {
  id: "e",
  calendarId: "c",
  title: "Trip",
  start: "2026-03-10",
  end: "2026-03-13",
  allDay: true,
  isTimed: false,
};
const calendar = { id: "c", summary: "Personal", accessRole: "owner" };
const boot = {
  today: "2026-03-10",
  connected: true,
  width: 1000,
  theme: "light" as const,
  sidebarCollapsed: false,
  fontSize: "medium",
  density: "comfortable",
  platform: "Linux",
  reducedMotion: true,
};
const failing = Effect.fail(new CalendarFailure({ message: "Offline" }));
const ports: PortsShape = {
  boot: Effect.succeed(boot),
  source: () => ({
    load: () =>
      Effect.succeed({
        events: [event],
        calendars: [calendar],
        selectedCalendarIds: ["c"],
        failures: [],
      }),
    persistSelection: () => undefined,
  }),
  api: () => ({
    createEvent: () => Effect.succeed(event),
    updateEvent: () => Effect.void,
    moveEvent: () => Effect.void,
    deleteEvent: () => Effect.void,
  }),
  connect: Effect.void,
  callback: Effect.void,
  logout: Effect.void,
  external: () => Effect.void,
  preference: () => Effect.void,
  sidebar: () => Effect.void,
  resetDemo: Effect.void,
};
const layer = Layer.succeed(CalendarPorts, CalendarPorts.of(ports));

describe("Foldkit I/O commands", () => {
  it.effect("loads, mutates and authenticates through injectable ports", () =>
    Effect.gen(function* () {
      expect(yield* Boot().effect).toMatchObject({ _tag: "Booted", connected: true });
      expect((yield* LoadYear({ year: 2026, id: 1, demo: false, reset: false }).effect)._tag).toBe(
        "SucceededLoad",
      );
      expect((yield* LoadYear({ year: 2026, id: 2, demo: true, reset: true }).effect)._tag).toBe(
        "SucceededLoad",
      );
      for (const operation of ["create", "edit", "delete"] as const) {
        expect(
          (yield* MutateEvent({
            year: 2026,
            demo: false,
            operation,
            event,
            calendar,
            title: "New",
            date: event.start,
          }).effect)._tag,
        ).toBe("SucceededMutation");
      }
      for (const operation of ["connect", "callback", "logout"] as const) {
        expect((yield* Auth({ operation }).effect)._tag).toBe(
          operation === "logout" ? "LoggedOut" : "SucceededAuth",
        );
      }
      expect((yield* OpenExternal({ href: "https://calendar.google.com/" }).effect)._tag).toBe(
        "Completed",
      );
      expect(
        (yield* MutateEvent({
          year: 2026,
          demo: true,
          operation: "create",
          event: null,
          calendar: null,
          title: "New",
          date: event.start,
        }).effect)._tag,
      ).toBe("FailedMutation");
      expect(
        (yield* MutateEvent({
          year: 2026,
          demo: true,
          operation: "edit",
          event: null,
          calendar,
          title: "New",
          date: event.start,
        }).effect)._tag,
      ).toBe("FailedMutation");
    }).pipe(Effect.provide(layer)),
  );

  it.effect("turns typed load, auth and move failures into Messages", () =>
    Effect.gen(function* () {
      expect((yield* LoadYear({ year: 2026, id: 1, demo: false, reset: false }).effect)._tag).toBe(
        "FailedLoad",
      );
      expect((yield* Auth({ operation: "callback" }).effect)._tag).toBe("FailedAuth");
      expect(
        (yield* MoveEvent({ id: 1, before: event, date: "2026-04-02", demo: false, fail: false })
          .effect)._tag,
      ).toBe("FailedMove");
    }).pipe(
      Effect.provideService(CalendarPorts, {
        ...ports,
        connect: failing,
        callback: failing,
        source: () => ({ load: () => failing, persistSelection: () => undefined }),
        api: () => ({ ...ports.api(false), moveEvent: () => failing }),
      }),
    ),
  );

  it.effect("drives the demo failure and tour delays with TestClock", () =>
    Effect.gen(function* () {
      const move = yield* Effect.forkChild(
        MoveEvent({ id: 2, before: event, date: "2026-04-02", demo: true, fail: true }).effect,
      );
      yield* TestClock.adjust(700);
      expect((yield* Fiber.join(move))._tag).toBe("FailedMove");
      const tick = yield* Effect.forkChild(TourTick({ step: 2, millis: 500 }).effect);
      yield* TestClock.adjust(500);
      expect(yield* Fiber.join(tick)).toMatchObject({ _tag: "AdvancedTour", step: 2 });
    }).pipe(Effect.provide(layer)),
  );

  it.effect("rejects read-only or missing demo events and missing callback codes", () =>
    Effect.gen(function* () {
      const browser = yield* CalendarPorts;
      const data = yield* browser.source(true).load(2026);
      const task = data.events.find((item) => item.calendarId === "__google_tasks__")!;
      expect(
        (yield* Effect.flip(browser.api(true).deleteEvent(task.calendarId, task.id)))._tag,
      ).toBe("CalendarFailure");
      expect(
        (yield* Effect.flip(browser.api(true).deleteEvent("demo-personal", "missing")))._tag,
      ).toBe("CalendarFailure");
      expect((yield* Effect.flip(browser.callback)).message).toContain("authorization code");
    }).pipe(Effect.provide(browserPortsLayer)),
  );
});
