// Shared outgoing-HTTP policy for Google calls.
//
// Two clients need this policy — the authorized API client and the token-refresh
// client — and they cannot import each other (the API client depends on the
// token store). Keeping the policy here stops the two from drifting apart.
//
// Ordering note: `retryTransient` defaults to `retryOn: "errors-and-responses"`,
// so it retries transient *responses* (408/429/5xx) as well as transport
// errors. That means it is correct on either side of `filterStatusOk`. Both
// call sites nonetheless go through this helper and apply the retry to the raw
// client first, so the behaviour is identical and reviewable in one place.
import { Effect, Schedule } from "effect";
import { HttpClient, HttpClientError } from "effect/unstable/http";

// Exponential with jitter: jitter matters because several tabs waking from
// sleep would otherwise retry in lockstep against the same quota.
const transientBackoff = Schedule.exponential("250 millis").pipe(Schedule.jittered);

// Effect's HttpClient propagates the current span by default, adding `b3` and
// `traceparent` request headers. Both are non-safelisted, so in the browser they
// join the CORS preflight's `Access-Control-Request-Headers`. Google's calendar
// API only allows `authorization` there and answers any other name with a bare
// 403 that carries no `Access-Control-Allow-Origin` — the browser then blocks
// the real request and every call fails as an opaque transport error. Nothing
// collects these traces client-side anyway, so turn propagation off.
const withoutTracePropagation = <E, R>(
  client: HttpClient.HttpClient.With<E, R>,
): HttpClient.HttpClient.With<E, R> =>
  client.pipe(
    HttpClient.transformResponse(Effect.provideService(HttpClient.TracerPropagationEnabled, false)),
  );

// A client that retries transient failures, then fails on any non-2xx status.
export const okClientWithRetry = <E, R>(
  client: HttpClient.HttpClient.With<E, R>,
  times: number,
): HttpClient.HttpClient.With<E | HttpClientError.HttpClientError, R> =>
  retryingClient(client, times).pipe(HttpClient.filterStatusOk);

// A client that retries transient failures but leaves status handling to the
// caller, for operations where a specific non-2xx is a success (e.g. 410 Gone
// on a delete that already happened).
export const retryingClient = <E, R>(
  client: HttpClient.HttpClient.With<E, R>,
  times: number,
): HttpClient.HttpClient.With<E, R> =>
  withoutTracePropagation(client).pipe(
    HttpClient.retryTransient({ schedule: transientBackoff, times }),
  );
