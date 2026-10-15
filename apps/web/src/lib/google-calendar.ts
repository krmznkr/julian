// The Promise boundary for Google sign-in, used by route pages and click
// handlers. Everything that loads or writes calendar data stays an `Effect`
// (see the year-view ports); only these one-shot auth actions cross into
// `async` React code. Failures reject with the typed error from
// `@julian/google/errors`, which is an `Error` carrying its `_tag`.
import { Effect } from "effect";
import { runPromise } from "@/lib/effect/runtime";
import { GoogleAuth } from "@julian/google/google-auth";
import { clearSessionHint, markSessionHint } from "@/lib/session";

export function startGoogleAuth(): Promise<void> {
  return runPromise(Effect.flatMap(GoogleAuth, (auth) => auth.start));
}

export function handleAuthCallback(code: string, redirectUri?: string): Promise<void> {
  return runPromise(
    Effect.flatMap(GoogleAuth, (auth) => auth.handleCallback(code, redirectUri)).pipe(
      Effect.tap(() => Effect.sync(markSessionHint)),
    ),
  );
}

// A confirmed session also (re)sets the hint, which covers browsers that
// signed in before the hint existed.
export function isAuthenticated(): Promise<boolean> {
  return runPromise(
    Effect.flatMap(GoogleAuth, (auth) => auth.isAuthenticated).pipe(
      Effect.tap((authed) => Effect.sync(() => (authed ? markSessionHint() : undefined))),
    ),
  );
}

export function logout(): Promise<void> {
  return runPromise(
    Effect.flatMap(GoogleAuth, (auth) => auth.logout).pipe(
      Effect.ensuring(Effect.sync(clearSessionHint)),
    ),
  );
}
