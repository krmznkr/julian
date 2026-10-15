// The authorized HTTP boundary: retry policy, auth failures and typed decoding.
import { describe, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Fiber, Layer, Option, Ref } from "effect";
import { FetchHttpClient } from "effect/http";
import { TestClock } from "effect/testing";
import { GoogleApiError, NotAuthenticatedError } from "./errors";
import { GoogleAuth } from "./google-auth";
import { GoogleCalendarApi } from "./google-calendar-api";
import { KeyValueStore } from "./key-value-store";
import type { NavigationCall } from "./navigation";
import * as TestEnv from "./testing";
import { STORAGE_KEYS } from "./token-store";

const listCalendars = Effect.flatMap(GoogleCalendarApi, (api) => api.listCalendars);

describe("retry policy", () => {
  it.effect("retries a transient failure on a read with backoff, then succeeds", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({
        storage: TestEnv.validTokenStorage(),
        config: { retryTimes: 2 },
        responses: [
          TestEnv.jsonResponse({ error: "backendError" }, 503),
          TestEnv.jsonResponse({ items: [{ id: "cal", summary: "Personal" }] }),
        ],
      });

      const fiber = yield* listCalendars.pipe(Effect.provide(env.layer), Effect.forkChild);
      // The backoff sleeps on the clock, so nothing happens until time moves.
      yield* TestClock.adjust("10 seconds");
      const calendars = yield* Fiber.join(fiber);

      expect(calendars.map((calendar) => calendar.id)).toEqual(["cal"]);
      expect(yield* Ref.get(env.fetch.requests)).toHaveLength(2);
    }),
  );

  it.effect("gives up after the configured number of retries", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({
        storage: TestEnv.validTokenStorage(),
        config: { retryTimes: 2 },
        responses: [() => TestEnv.jsonResponse({ error: "rateLimitExceeded" }, 429)],
      });

      const fiber = yield* Effect.flip(listCalendars).pipe(
        Effect.provide(env.layer),
        Effect.forkChild,
      );
      yield* TestClock.adjust("1 minute");
      const error = yield* Fiber.join(fiber);

      expect(error).toBeInstanceOf(GoogleApiError);
      expect((error as GoogleApiError).status).toBe(429);
      expect(yield* Ref.get(env.fetch.requests)).toHaveLength(3);
    }),
  );

  it.effect("does not retry a client error", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({
        storage: TestEnv.validTokenStorage(),
        config: { retryTimes: 3 },
        responses: [() => TestEnv.jsonResponse({ error: "notFound" }, 404)],
      });

      const error = yield* Effect.flip(listCalendars).pipe(Effect.provide(env.layer));

      expect((error as GoogleApiError).status).toBe(404);
      expect(yield* Ref.get(env.fetch.requests)).toHaveLength(1);
    }),
  );
});

describe("interruption", () => {
  it.effect("aborts the in-flight fetch when the calling fiber is interrupted", () =>
    Effect.gen(function* () {
      const signals: Array<AbortSignal> = [];
      // A request that never answers on its own, like a stalled connection.
      const hangingFetch: typeof globalThis.fetch = (_input, init) => {
        if (init?.signal) signals.push(init.signal);
        return new Promise<Response>(() => {});
      };
      const requests = yield* Ref.make<ReadonlyArray<TestEnv.RecordedRequest>>([]);
      const navigations = yield* Ref.make<ReadonlyArray<NavigationCall>>([]);
      const layer = TestEnv.layer({
        fetch: { requests, layer: Layer.succeed(FetchHttpClient.Fetch, hangingFetch) },
        navigations,
        storage: TestEnv.validTokenStorage(),
      });

      const fiber = yield* listCalendars.pipe(Effect.provide(layer), Effect.forkChild);
      yield* Effect.yieldNow;
      expect(signals).toHaveLength(1);
      expect(signals[0]?.aborted).toBe(false);

      yield* Fiber.interrupt(fiber);
      expect(signals[0]?.aborted).toBe(true);
    }),
  );
});

describe("authentication failures", () => {
  it.effect("fails with NotAuthenticated without calling Google when no token is stored", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({ responses: [TestEnv.jsonResponse({})] });

      const error = yield* Effect.flip(listCalendars).pipe(Effect.provide(env.layer));

      expect(error).toBeInstanceOf(NotAuthenticatedError);
      expect(yield* Ref.get(env.fetch.requests)).toHaveLength(0);
    }),
  );

  it.effect("maps a 401 on a read to NotAuthenticated", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({
        storage: TestEnv.validTokenStorage(),
        responses: [TestEnv.jsonResponse({ error: "unauthorized" }, 401)],
      });

      const error = yield* Effect.flip(listCalendars).pipe(Effect.provide(env.layer));

      expect(error._tag).toBe("Google.NotAuthenticated");
    }),
  );

  it.effect("maps a 401 on a write to NotAuthenticated", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({
        storage: TestEnv.validTokenStorage(),
        responses: [TestEnv.jsonResponse({ error: "unauthorized" }, 401)],
      });

      const error = yield* Effect.flip(
        Effect.flatMap(GoogleCalendarApi, (api) => api.deleteEvent("cal", "event")),
      ).pipe(Effect.provide(env.layer));

      expect(error._tag).toBe("Google.NotAuthenticated");
    }),
  );
});

describe("typed decoding", () => {
  it.effect("fails with a typed error when a refresh returns a malformed token", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({
        storage: TestEnv.expiredTokenStorage(),
        responses: [TestEnv.jsonResponse({ access_token: 42 })],
      });

      const error = yield* Effect.flip(
        Effect.flatMap(GoogleAuth, (auth) => auth.isAuthenticated),
      ).pipe(Effect.provide(env.layer));

      expect(error).toBeInstanceOf(GoogleApiError);
      expect(error.message).toBe("Invalid token response");
    }),
  );

  it.effect("fails with a typed error when the calendar list is malformed", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({
        storage: TestEnv.validTokenStorage(),
        responses: [TestEnv.jsonResponse({ items: [{ summary: "no id" }] })],
      });

      const error = yield* Effect.flip(listCalendars).pipe(Effect.provide(env.layer));

      expect(error).toBeInstanceOf(GoogleApiError);
      expect((error as GoogleApiError).operation).toMatch(/^GoogleCalendar\./);
    }),
  );
});

describe("GoogleAuth callback and logout", () => {
  it.effect("exchanges the code, stores the token and drops the verifier", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({
        storage: { [STORAGE_KEYS.codeVerifier]: "verifier" },
        responses: [
          TestEnv.jsonResponse({ access_token: "fresh", expires_in: 3600, refresh_token: "r" }),
        ],
      });

      const stored = yield* Effect.gen(function* () {
        const auth = yield* GoogleAuth;
        yield* auth.handleCallback("code");
        const authenticated = yield* auth.isAuthenticated;
        const store = yield* KeyValueStore;
        return {
          authenticated,
          verifier: yield* store.get(STORAGE_KEYS.codeVerifier),
          refresh: yield* store.get(STORAGE_KEYS.refreshToken),
        };
      }).pipe(Effect.provide(env.layer));

      expect(stored.authenticated).toBe(true);
      expect(Option.isNone(stored.verifier)).toBe(true);
      expect(Option.getOrNull(stored.refresh)).toBe("r");
      const [request] = yield* Ref.get(env.fetch.requests);
      expect(request?.url).toBe("http://localhost:3000/api/oauth/token");
    }),
  );

  it.effect("fails with a typed config error when the verifier is missing", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({ responses: [TestEnv.jsonResponse({})] });

      const error = yield* Effect.flip(
        Effect.flatMap(GoogleAuth, (auth) => auth.handleCallback("code")),
      ).pipe(Effect.provide(env.layer));

      expect(error._tag).toBe("Google.AuthConfigError");
      expect(yield* Ref.get(env.fetch.requests)).toHaveLength(0);
    }),
  );

  it.effect("forgets every stored credential on logout", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({
        storage: TestEnv.validTokenStorage(),
        responses: [TestEnv.jsonResponse({})],
      });

      const authenticated = yield* Effect.gen(function* () {
        const auth = yield* GoogleAuth;
        yield* auth.logout;
        return yield* auth.isAuthenticated;
      }).pipe(Effect.provide(env.layer));

      expect(authenticated).toBe(false);
    }),
  );
});

describe("GoogleCalendarApi writes", () => {
  it.effect("updates an event title with a PATCH", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({
        storage: TestEnv.validTokenStorage(),
        responses: [TestEnv.jsonResponse({ id: "event" })],
      });

      yield* Effect.flatMap(GoogleCalendarApi, (api) =>
        api.updateEvent("cal", "event", { title: "Renamed" }),
      ).pipe(Effect.provide(env.layer));

      const [request] = yield* Ref.get(env.fetch.requests);
      expect(request?.method).toBe("PATCH");
      expect(request?.url).toContain("/calendars/cal/events/event");
    }),
  );

  it.effect("moves an all-day event by patching its dates", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({
        storage: TestEnv.validTokenStorage(),
        responses: [TestEnv.jsonResponse({ id: "event" })],
      });

      yield* Effect.flatMap(GoogleCalendarApi, (api) =>
        api.moveEvent("cal", "event", { start: "2026-04-02", end: "2026-04-04" }),
      ).pipe(Effect.provide(env.layer));

      const [request] = yield* Ref.get(env.fetch.requests);
      expect(request?.method).toBe("PATCH");
      expect(JSON.parse(String(request?.body))).toEqual({
        start: { date: "2026-04-02" },
        end: { date: "2026-04-04" },
      });
    }),
  );

  it.effect("treats deleting an already-deleted event as success", () =>
    Effect.gen(function* () {
      const env = yield* TestEnv.makeTestEnv({
        storage: TestEnv.validTokenStorage(),
        responses: [new Response(null, { status: 410 })],
      });

      yield* Effect.flatMap(GoogleCalendarApi, (api) => api.deleteEvent("cal", "event")).pipe(
        Effect.provide(env.layer),
      );

      const [request] = yield* Ref.get(env.fetch.requests);
      expect(request?.method).toBe("DELETE");
    }),
  );

  it.effect("creates an all-day event and returns it", () =>
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

      const event = yield* Effect.flatMap(GoogleCalendarApi, (api) =>
        api.createEvent(
          { id: "cal", summary: "Personal" },
          { title: "Dinner", date: "2026-09-12" },
        ),
      ).pipe(Effect.provide(env.layer));

      expect(event).toMatchObject({ id: "created", title: "Dinner", calendarId: "cal" });
    }),
  );
});
