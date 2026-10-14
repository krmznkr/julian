import { describe, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Exit, Ref } from "effect";
import * as TestEnv from "@julian/google/testing";
import { makeGoogleDataSource, makeGoogleEventApi } from "@/components/year-view/google-ports";
import type { AppServices } from "@/lib/effect/runtime";

const ports = (env: { readonly layer: ReturnType<typeof TestEnv.layer> }) => {
  const provide = <A, E>(effect: Effect.Effect<A, E, AppServices>): Effect.Effect<A, E> =>
    Effect.provide(effect, env.layer);
  return { dataSource: makeGoogleDataSource(provide), eventApi: makeGoogleEventApi(provide) };
};

describe("Google year-view ports", () => {
  it.effect("loads an empty year without calling Google when signed out", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({ responses: [TestEnv.jsonResponse({})] });

      const year = yield* ports(env).dataSource.load(2026);

      expect(year).toEqual({ calendars: [], selectedCalendarIds: [], events: [], failures: [] });
      expect(yield* Ref.get(env.fetch.requests)).toHaveLength(0);
    }),
  );

  it.effect("loads the signed-in user's calendars, keeping hidden ones deselected", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({
        storage: { ...TestEnv.validTokenStorage(), "julian:hidden-calendar-ids": '["cal"]' },
        responses: [
          TestEnv.jsonResponse({ items: [{ id: "cal", summary: "Personal" }] }),
          TestEnv.jsonResponse({ items: [] }),
          TestEnv.jsonResponse({ items: [] }),
        ],
      });
      const year = yield* ports(env).dataSource.load(2026);

      expect(year.calendars.map((calendar) => calendar.id)).toContain("cal");
      expect(year.selectedCalendarIds).not.toContain("cal");
    }),
  );

  it.effect("surfaces a write failure as a typed error with a message", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({
        storage: TestEnv.validTokenStorage(),
        responses: [TestEnv.jsonResponse({ error: "backendError" }, 500)],
      });

      const exit = yield* Effect.exit(
        ports(env).eventApi.updateEvent("cal", "event", { title: "Renamed" }),
      );

      expect(Exit.isFailure(exit)).toBe(true);
      const error = yield* Effect.flip(ports(env).eventApi.deleteEvent("cal", "event"));
      expect(error._tag).toBe("Google.ApiError");
      expect(error.message).toBe("Failed to delete event");
    }),
  );

  it.effect("creates an event through the calendar API", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({
        storage: TestEnv.validTokenStorage(),
        responses: [
          TestEnv.jsonResponse({
            id: "created",
            summary: "Dinner",
            start: { date: "2026-09-12" },
            end: { date: "2026-09-13" },
          }),
        ],
      });

      const event = yield* ports(env).eventApi.createEvent(
        { id: "cal", summary: "Personal" },
        { title: "Dinner", date: "2026-09-12" },
      );

      expect(event.id).toBe("created");
    }),
  );
});
