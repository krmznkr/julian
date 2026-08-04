// Tests for the Google API boundary.
//
// These run the real service graph over an explicit test layer (stub fetch,
// in-memory storage) rather than through the shared app runtime with a global
// `fetch` spy. That keeps each case isolated: the previous approach depended on
// `globalThis.fetch` being re-read per request, which the v4 fetch client does
// not do.
import { describe, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Option, Ref } from "effect";
import { STORAGE_KEYS } from "@/lib/effect/token-store";
import { GoogleApiError } from "@/lib/effect/errors";
import * as TestEnv from "@/lib/effect/testing";
import { KeyValueStore } from "@/lib/effect/key-value-store";
import { NavigationCall } from "@/lib/effect/navigation";
import { GoogleAuth } from "@/lib/effect/google-auth";
import { GoogleCalendarApi } from "@/lib/effect/google-calendar-api";
import { GoogleTasks } from "@/lib/effect/google-tasks";
import { loadCalendarYear } from "@/lib/effect/calendar-year";

const validToken = {
  [STORAGE_KEYS.accessToken]: "token",
  [STORAGE_KEYS.expiresAt]: String(Date.now() + 120_000),
};

const expiredWithRefresh = {
  [STORAGE_KEYS.accessToken]: "old",
  [STORAGE_KEYS.expiresAt]: String(Date.now() - 1_000),
  [STORAGE_KEYS.refreshToken]: "refresh",
};

// Assemble the graph for one case.
const withEnv = (options: {
  readonly responses: ReadonlyArray<Response | (() => Response)>;
  readonly storage?: Readonly<Record<string, string>>;
}) =>
  Effect.gen(function* () {
    const fetch = yield* TestEnv.makeFetchStub(options.responses);
    const navigations = yield* Ref.make<ReadonlyArray<NavigationCall>>([]);
    return {
      fetch,
      navigations,
      layer: TestEnv.layer({ fetch, navigations, storage: options.storage }),
    };
  });

describe("GoogleCalendar.listEvents", () => {
  it.effect("loads every page of expanded recurring event instances", () =>
    Effect.gen(function* () {
      const env = yield* withEnv({
        storage: validToken,
        responses: [
          TestEnv.jsonResponse({
            nextPageToken: "page-2",
            items: [
              {
                id: "recurring-instance-1",
                summary: "Daily standup",
                recurringEventId: "daily-series",
                start: { dateTime: "2026-01-02T09:00:00.000Z" },
                end: { dateTime: "2026-01-02T09:30:00.000Z" },
              },
            ],
          }),
          TestEnv.jsonResponse({
            items: [
              {
                id: "recurring-instance-2",
                summary: "Daily standup",
                recurringEventId: "daily-series",
                start: { dateTime: "2026-06-01T09:00:00.000Z" },
                end: { dateTime: "2026-06-01T09:30:00.000Z" },
              },
            ],
          }),
        ],
      });

      const events = yield* Effect.flatMap(GoogleCalendarApi, (calendar) =>
        calendar.listEvents("primary", new Date(2026, 0, 1), new Date(2027, 0, 1)),
      ).pipe(Effect.provide(env.layer));

      expect(events.map((event) => event.id)).toEqual([
        "recurring-instance-1",
        "recurring-instance-2",
      ]);
      expect(events[1]?.recurringEventId).toBe("daily-series");

      const requests = yield* Ref.get(env.fetch.requests);
      expect(requests).toHaveLength(2);

      const first = new URL(requests[0]!.url);
      const second = new URL(requests[1]!.url);
      expect(first.searchParams.get("singleEvents")).toBe("true");
      expect(first.searchParams.get("orderBy")).toBe("startTime");
      expect(first.searchParams.get("maxResults")).toBe("2500");
      expect(second.searchParams.get("pageToken")).toBe("page-2");
    }),
  );

  it.effect("rejects a payload whose event is missing the required id via Schema", () =>
    Effect.gen(function* () {
      const env = yield* withEnv({
        storage: validToken,
        responses: [
          TestEnv.jsonResponse({
            items: [{ summary: "No id here", start: { dateTime: "2026-01-02T09:00:00.000Z" } }],
          }),
        ],
      });

      const error = yield* Effect.flip(
        Effect.flatMap(GoogleCalendarApi, (calendar) =>
          calendar.listEvents("primary", new Date(2026, 0, 1), new Date(2027, 0, 1)),
        ).pipe(Effect.provide(env.layer)),
      );

      expect(error).toBeInstanceOf(GoogleApiError);
      expect(error.message).toMatch(/Failed to fetch events/i);
    }),
  );

  it.effect("fails a non-2xx response with the originating status", () =>
    Effect.gen(function* () {
      const env = yield* withEnv({
        storage: validToken,
        responses: [() => TestEnv.jsonResponse({ error: "nope" }, 500)],
      });

      const error = yield* Effect.flip(
        Effect.flatMap(GoogleCalendarApi, (calendar) =>
          calendar.listEvents("primary", new Date(2026, 0, 1), new Date(2027, 0, 1)),
        ).pipe(Effect.provide(env.layer)),
      );

      expect(error).toBeInstanceOf(GoogleApiError);
      expect((error as GoogleApiError).status).toBe(500);
      expect((error as GoogleApiError)._tag).toBe("Google.ApiError");
    }),
  );
});

describe("TokenStore refresh", () => {
  it.effect("does not force logout on a transient 5xx during refresh", () =>
    Effect.gen(function* () {
      const env = yield* withEnv({
        storage: expiredWithRefresh,
        responses: [() => TestEnv.jsonResponse({ error: "nope" }, 503)],
      });

      // The refresh failure must surface, NOT be swallowed into "signed out".
      const error = yield* Effect.flatMap(GoogleAuth, (auth) =>
        Effect.flip(auth.isAuthenticated),
      ).pipe(Effect.provide(env.layer));

      expect(error).toBeInstanceOf(GoogleApiError);
      expect((error as GoogleApiError).status).toBe(503);
    }),
  );

  it.effect("clears tokens and reports unauthenticated on a 400 (invalid refresh token)", () =>
    Effect.gen(function* () {
      const env = yield* withEnv({
        storage: expiredWithRefresh,
        responses: [() => TestEnv.jsonResponse({ error: "invalid_grant" }, 400)],
      });

      const result = yield* Effect.gen(function* () {
        const auth = yield* GoogleAuth;
        const authenticated = yield* auth.isAuthenticated;
        const store = yield* KeyValueStore;
        return {
          authenticated,
          refreshToken: yield* store.get(STORAGE_KEYS.refreshToken),
          accessToken: yield* store.get(STORAGE_KEYS.accessToken),
        };
      }).pipe(Effect.provide(env.layer));

      expect(result.authenticated).toBe(false);
      // A rejected refresh token must be discarded, not left behind to be
      // replayed on every subsequent request.
      expect(Option.isNone(result.refreshToken)).toBe(true);
      expect(Option.isNone(result.accessToken)).toBe(true);
    }),
  );
});

describe("GoogleAuth", () => {
  it.effect("redirects to Google with a PKCE challenge and stores the verifier", () =>
    Effect.gen(function* () {
      const env = yield* withEnv({ responses: [() => TestEnv.jsonResponse({}, 200)] });

      const stored = yield* Effect.gen(function* () {
        const auth = yield* GoogleAuth;
        yield* auth.start;
        const store = yield* KeyValueStore;
        return yield* store.get(STORAGE_KEYS.codeVerifier);
      }).pipe(Effect.provide(env.layer));

      const calls = yield* Ref.get(env.navigations);
      expect(calls).toHaveLength(1);

      const url = new URL(calls[0]!.url);
      expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
      expect(url.searchParams.get("code_challenge_method")).toBe("S256");
      expect(url.searchParams.get("response_type")).toBe("code");
      // The verifier must be persisted, otherwise the callback cannot complete.
      expect(Option.isSome(stored)).toBe(true);
      // The challenge must be the hash, never the verifier itself.
      expect(url.searchParams.get("code_challenge")).not.toBe(Option.getOrElse(stored, () => ""));
    }),
  );

  it.effect("fails with a typed config error when no client id is configured", () =>
    Effect.gen(function* () {
      const fetch = yield* TestEnv.makeFetchStub([() => TestEnv.jsonResponse({}, 200)]);
      const navigations = yield* Ref.make<ReadonlyArray<NavigationCall>>([]);
      const layer = TestEnv.layer({ fetch, navigations, config: { clientId: "" } });

      const error = yield* Effect.flip(
        Effect.flatMap(GoogleAuth, (auth) => auth.start).pipe(Effect.provide(layer)),
      );

      expect(error._tag).toBe("Google.AuthConfigError");
      // A misconfigured build must not navigate the user anywhere.
      expect(yield* Ref.get(navigations)).toHaveLength(0);
    }),
  );
});

describe("loadCalendarYear", () => {
  it.effect("keeps the year usable when one calendar fails, and reports the failure", () =>
    Effect.gen(function* () {
      let call = 0;
      const env = yield* withEnv({
        storage: validToken,
        responses: [
          () => {
            call += 1;
            // 1: calendar list. 2/3: per-calendar events. 4+: tasks.
            if (call === 1) {
              return TestEnv.jsonResponse({
                items: [
                  { id: "good", summary: "Good" },
                  { id: "bad", summary: "Bad" },
                ],
              });
            }
            if (call === 2) {
              return TestEnv.jsonResponse({
                items: [
                  {
                    id: "e1",
                    summary: "Works",
                    start: { date: "2026-03-01" },
                    end: { date: "2026-03-02" },
                  },
                ],
              });
            }
            if (call === 3) return TestEnv.jsonResponse({ error: "boom" }, 500);
            return TestEnv.jsonResponse({ items: [] });
          },
        ],
      });

      const data = yield* loadCalendarYear(2026).pipe(Effect.provide(env.layer));

      // The working calendar still renders...
      expect(data.events.length).toBeGreaterThanOrEqual(1);
      // ...and the broken one is reported rather than silently empty.
      expect(data.failures.length).toBeGreaterThanOrEqual(1);
      expect(data.calendars.map((calendar) => calendar.id)).toContain("good");
    }),
  );
});

describe("outgoing request headers", () => {
  // Regression: Effect's HttpClient propagates the active span by default, which
  // adds `b3` and `traceparent`. Neither is CORS-safelisted, so the browser
  // lists them in the preflight's `Access-Control-Request-Headers`; Google only
  // allows `authorization` and answers anything else with a 403 that has no
  // `Access-Control-Allow-Origin`, blocking every call from the real origin.
  it.effect("sends no trace-propagation headers to Google", () =>
    Effect.gen(function* () {
      const env = yield* withEnv({
        storage: validToken,
        responses: [() => TestEnv.jsonResponse({ items: [{ id: "c1", summary: "C" }] })],
      });

      yield* Effect.flatMap(GoogleCalendarApi, (calendar) => calendar.listCalendars).pipe(
        Effect.provide(env.layer),
      );

      const [request] = yield* Ref.get(env.fetch.requests);
      expect(request).toBeDefined();
      // Auth still goes out; only the tracing headers are gone.
      expect(request?.headers["authorization"]).toBe("Bearer token");
      expect(request?.headers).not.toHaveProperty("b3");
      expect(request?.headers).not.toHaveProperty("traceparent");
    }),
  );
});

describe("GoogleCalendarApi.createEvent", () => {
  it.effect("rejects a malformed date locally without calling Google", () =>
    Effect.gen(function* () {
      const env = yield* withEnv({
        storage: validToken,
        responses: [() => TestEnv.jsonResponse({ id: "e1" })],
      });

      const error = yield* Effect.flip(
        Effect.flatMap(GoogleCalendarApi, (calendar) =>
          calendar.createEvent(
            { id: "c1", summary: "C", backgroundColor: null },
            {
              title: "Nope",
              date: "not-a-date",
            },
          ),
        ).pipe(Effect.provide(env.layer)),
      );

      expect(error).toBeInstanceOf(GoogleApiError);
      expect(error.message).toMatch(/Invalid event date/);
      // The malformed input must never reach Google.
      expect(yield* Ref.get(env.fetch.requests)).toHaveLength(0);
    }),
  );
});

describe("TokenStore single-flight refresh", () => {
  it.effect("refreshes once when many authorized requests race an expired token", () =>
    Effect.gen(function* () {
      const env = yield* withEnv({
        storage: expiredWithRefresh,
        responses: [() => TestEnv.jsonResponse({ access_token: "fresh", expires_in: 3600 })],
      });

      // Ten concurrent authorized calls, all finding the token expired.
      yield* Effect.forEach(
        Array.from({ length: 10 }, (_, i) => i),
        () => Effect.flatMap(GoogleTasks, (tasks) => tasks.listTaskLists),
        { concurrency: "unbounded" },
      ).pipe(
        Effect.provide(env.layer),
        Effect.orElseSucceed(() => []),
      );

      const refreshCalls = (yield* Ref.get(env.fetch.requests)).filter((request) =>
        request.url.includes("/refresh"),
      );
      // Without single-flight this would be one refresh per racing caller.
      expect(refreshCalls).toHaveLength(1);
    }),
  );
});

describe("GoogleTasks.listTasks", () => {
  it.effect("follows nextPageToken instead of stopping at the first page", () =>
    Effect.gen(function* () {
      let call = 0;
      const env = yield* withEnv({
        storage: validToken,
        responses: [
          () => {
            call += 1;
            return call === 1
              ? TestEnv.jsonResponse({
                  items: [{ id: "t1", title: "One" }],
                  nextPageToken: "next",
                })
              : TestEnv.jsonResponse({ items: [{ id: "t2", title: "Two" }] });
          },
        ],
      });

      const tasks = yield* Effect.flatMap(GoogleTasks, (service) =>
        service.listTasks("list-1"),
      ).pipe(Effect.provide(env.layer));

      expect(tasks.map((task) => task.id)).toEqual(["t1", "t2"]);

      const urls = (yield* Ref.get(env.fetch.requests)).map((request) => request.url);
      expect(new URL(urls[1]!).searchParams.get("pageToken")).toBe("next");
    }),
  );
});
