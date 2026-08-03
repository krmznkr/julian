// Shared Effect runtime for the browser app.
//
// The app's side-effecting layer (Google Calendar/Tasks I/O, storage,
// navigation, background tasks) is written as `Effect` values. React components
// stay idiomatic and cross the boundary through these helpers, which execute an
// `Effect` on a single long-lived runtime.
//
// The layer graph is flat and topologically ordered: infrastructure at the
// bottom, then credentials, then the authorized HTTP boundary, then the API
// services. Dependencies that consumers should not see (the raw `HttpClient`)
// are hidden with `Layer.provide`; nothing is wired with a blanket `mergeAll`.
import { Cause, Effect, Exit, Layer, ManagedRuntime } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import { appConfigLayer } from "@/lib/effect/config";
import { keyValueStoreLayer } from "@/lib/effect/key-value-store";
import { navigationLayer } from "@/lib/effect/navigation";
import { tokenStoreLayer } from "@/lib/effect/token-store";
import { googleHttpLayer } from "@/lib/effect/google-http";
import { googleAuthLayer } from "@/lib/effect/google-auth";
import { googleCalendarApiLayer } from "@/lib/effect/google-calendar-api";
import { googleTasksLayer } from "@/lib/effect/google-tasks";

// Browser platform services.
const InfrastructureLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  keyValueStoreLayer,
  navigationLayer,
);

// Credentials depend on config, storage and HTTP.
const CredentialsLayer = tokenStoreLayer.pipe(
  Layer.provideMerge(appConfigLayer),
  Layer.provideMerge(InfrastructureLayer),
);

// The authorized HTTP boundary, and the API services built on it.
const ApiLayer = Layer.mergeAll(
  googleCalendarApiLayer,
  googleTasksLayer,
  googleAuthLayer.pipe(Layer.provide(CredentialsLayer)),
).pipe(Layer.provide(googleHttpLayer), Layer.provide(CredentialsLayer));

// Only what consumers legitimately need is exposed. `TokenStore` and the raw
// `HttpClient` stay internal to the credentials graph, so no React-facing code
// can reach for a bearer token or issue an unauthenticated request. The rest is
// exposed because consumer effects resolve them directly: `AppConfig` and
// `KeyValueStore` for the year aggregation and stored preferences, `Navigation`
// for `openExternal`.
export const AppLayer = ApiLayer.pipe(
  Layer.provideMerge(Layer.mergeAll(appConfigLayer, keyValueStoreLayer, navigationLayer)),
);

export type AppServices = Layer.Success<typeof AppLayer>;

// A single long-lived runtime. `ManagedRuntime` memoizes layer construction so
// services (the HTTP client, the token store) are built once.
export const appRuntime = ManagedRuntime.make(AppLayer);

// Run an Effect on the app runtime and return a Promise. On failure this
// rejects with the *original* error value (the squashed `Cause`) rather than a
// wrapper, so callers can recover typed error metadata at the React boundary.
export function runPromise<A, E>(effect: Effect.Effect<A, E, AppServices>): Promise<A> {
  return appRuntime.runPromiseExit(effect).then((exit) => {
    if (Exit.isSuccess(exit)) return exit.value;
    throw Cause.squash(exit.cause);
  });
}

// Fire-and-forget: run an Effect on a background fiber. Error handling must be
// baked into the Effect itself.
export function runFork<A, E>(effect: Effect.Effect<A, E, AppServices>): void {
  appRuntime.runFork(effect);
}
