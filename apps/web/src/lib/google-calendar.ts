// The Promise boundary for Google sign-in, used by route pages and click
// handlers. Everything that loads or writes calendar data stays an `Effect`
// (see the year-view ports); only these one-shot auth actions cross into
// `async` React code. Failures reject with the typed error from
// `@julian/google/errors`, which is an `Error` carrying its `_tag`.
import { Effect } from "effect";
import { runPromise } from "@/lib/effect/runtime";
import { GoogleAuth } from "@julian/google/google-auth";

export function startGoogleAuth(): Promise<void> {
  return runPromise(Effect.flatMap(GoogleAuth, (auth) => auth.start));
}

export function handleAuthCallback(code: string, redirectUri?: string): Promise<void> {
  return runPromise(Effect.flatMap(GoogleAuth, (auth) => auth.handleCallback(code, redirectUri)));
}

export function isAuthenticated(): Promise<boolean> {
  return runPromise(Effect.flatMap(GoogleAuth, (auth) => auth.isAuthenticated));
}

export function logout(): Promise<void> {
  return runPromise(Effect.flatMap(GoogleAuth, (auth) => auth.logout));
}
