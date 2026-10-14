// Tests for the Google API boundary.
//
// These run the real service graph over an explicit test layer (stub fetch,
// in-memory storage) rather than a global `fetch` spy, so each case is isolated.
import { describe, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Option, Ref } from "effect";
import { STORAGE_KEYS } from "./token-store";
import { GoogleApiError } from "./errors";
import * as TestEnv from "./testing";
import { KeyValueStore } from "./key-value-store";
import { NavigationCall } from "./navigation";
import { GoogleAuth } from "./google-auth";
import { GoogleCalendarApi } from "./google-calendar-api";
import { GoogleTasks } from "./google-tasks";

const validToken = TestEnv.validTokenStorage();
const expiredWithRefresh = TestEnv.expiredTokenStorage();

const withEnv = (options: {
  readonly responses: ReadonlyArray<Response | (() => Response)>;
  readonly storage?: Readonly<Record<string, string>>;
  readonly retryTimes?: number;
}) =>
  TestEnv.makeTestEnv({
    responses: options.responses,
    storage: options.storage,
    config: { retryTimes: options.retryTimes ?? 0 },
  });

describe("GoogleCalendar.listEvents", () => {
  it.effect("preserves Google date types and skips cancelled or invalid records", () =>
    Effect.gen(function* () {
      const env = yield* withEnv({
        storage: validToken,
        responses: [
          TestEnv.jsonResponse({
            items: [
              { id: "day", start: { date: "2026-06-15" }, end: { date: "2026-06-16" } },
              {
                id: "night",
                start: { dateTime: "2026-06-15T23:00:00+02:00" },
                end: { dateTime: "2026-06-16T00:00:00+02:00" },
              },
              {
                id: "cancelled",
                status: "cancelled",
                start: { date: "2026-06-15" },
                end: { date: "2026-06-16" },
              },
              { id: "invalid", start: { date: "2026-02-30" }, end: { date: "2026-03-02" } },
              { id: "missing-end", start: { date: "2026-06-15" } },
            ],
          }),
        ],
      });
      const events = yield* Effect.flatMap(GoogleCalendarApi, (api) =>
        api.listEvents("cal", new Date(2026, 0, 1), new Date(2027, 0, 1)),
      ).pipe(Effect.provide(env.layer));
      expect(events.map((event) => event.id)).toEqual(["day", "night"]);
      expect(events[0]).toMatchObject({ allDay: true, start: "2026-06-15", end: "2026-06-16" });
      expect(events[1]).toMatchObject({
        allDay: false,
        start: "2026-06-15T23:00:00+02:00",
        end: "2026-06-16T00:00:00+02:00",
      });
    }),
  );
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
  it.effect("keeps credentials on rate limits, proxy rejection and client misconfiguration", () =>
    Effect.gen(function* () {
      for (const [status, code] of [
        [429, "rate_limited"],
        [403, "forbidden"],
        [400, "invalid_client"],
      ] as const) {
        const env = yield* withEnv({
          storage: expiredWithRefresh,
          responses: [TestEnv.jsonResponse({ error: code }, status)],
        });
        const result = yield* Effect.gen(function* () {
          const auth = yield* GoogleAuth;
          const error = yield* Effect.flip(auth.isAuthenticated);
          const store = yield* KeyValueStore;
          return { error, refresh: yield* store.get(STORAGE_KEYS.refreshToken) };
        }).pipe(Effect.provide(env.layer));
        expect(result.error.status).toBe(status);
        expect(Option.getOrNull(result.refresh)).toBe("refresh");
      }
    }),
  );
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
  it.effect("rejects impossible dates before sending a request", () =>
    Effect.gen(function* () {
      const env = yield* withEnv({ storage: validToken, responses: [] });
      for (const date of ["2026-02-29", "2026-04-31", "2026-02-30"]) {
        const error = yield* Effect.flip(
          Effect.flatMap(GoogleCalendarApi, (calendar) =>
            calendar.createEvent({ id: "c1", summary: "C" }, { title: "Invalid", date }),
          ).pipe(Effect.provide(env.layer)),
        );
        expect(error.message).toContain("Invalid event date");
      }
      expect(yield* Ref.get(env.fetch.requests)).toHaveLength(0);
    }),
  );

  it.effect("does not retry event creation after a server failure", () =>
    Effect.gen(function* () {
      const env = yield* withEnv({
        storage: validToken,
        retryTimes: 3,
        responses: [TestEnv.jsonResponse({ error: "backendError" }, 503)],
      });
      yield* Effect.flip(
        Effect.flatMap(GoogleCalendarApi, (calendar) =>
          calendar.createEvent(
            { id: "c1", summary: "C" },
            { title: "One event", date: "2026-09-12" },
          ),
        ).pipe(Effect.provide(env.layer)),
      );
      expect(yield* Ref.get(env.fetch.requests)).toHaveLength(1);
    }),
  );
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

describe("calendar and task-list discovery", () => {
  it.effect("loads all calendar pages", () =>
    Effect.gen(function* () {
      const env = yield* withEnv({
        storage: validToken,
        responses: [
          TestEnv.jsonResponse({
            items: [{ id: "c1", summary: "One" }],
            nextPageToken: "next page",
          }),
          TestEnv.jsonResponse({ items: [{ id: "c2", summary: "Two" }] }),
        ],
      });
      const calendars = yield* Effect.flatMap(GoogleCalendarApi, (api) => api.listCalendars).pipe(
        Effect.provide(env.layer),
      );
      expect(calendars.map((calendar) => calendar.id)).toEqual(["c1", "c2"]);
      const requests = yield* Ref.get(env.fetch.requests);
      expect(new URL(requests[1]!.url).searchParams.get("pageToken")).toBe("next page");
    }),
  );

  it.effect("loads all task-list pages", () =>
    Effect.gen(function* () {
      const env = yield* withEnv({
        storage: validToken,
        responses: [
          TestEnv.jsonResponse({ items: [{ id: "l1", title: "One" }], nextPageToken: "next page" }),
          TestEnv.jsonResponse({ items: [{ id: "l2", title: "Two" }] }),
        ],
      });
      const lists = yield* Effect.flatMap(GoogleTasks, (api) => api.listTaskLists).pipe(
        Effect.provide(env.layer),
      );
      expect(lists.map((list) => list.id)).toEqual(["l1", "l2"]);
      const requests = yield* Ref.get(env.fetch.requests);
      expect(new URL(requests[1]!.url).searchParams.get("pageToken")).toBe("next page");
    }),
  );
});
