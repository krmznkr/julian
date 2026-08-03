// Application configuration as an Effect service backed by `Config`.
//
// Values are read through `Config` rather than touching `import.meta.env` deep
// inside application logic. The default `ConfigProvider` in Effect v4 already
// merges `import.meta.env`, so Vite's build-time inlining works unchanged.
//
// Wrapping the resolved values in a service means tests provide
// `Layer.succeed(AppConfig, ...)` instead of stubbing module state, and
// a missing client id fails as a typed error at startup instead of producing a
// malformed OAuth URL at click time.
import { Config, Context, Effect, Layer } from "effect";

const DEFAULT_SCOPES: ReadonlyArray<string> = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/tasks.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

// The redirect URI is derived from where the app is actually served rather than
// configured, so a preview deployment authenticates against its own origin.
const defaultRedirectUri = (): string =>
  typeof location === "undefined"
    ? "http://localhost:3000/auth/callback"
    : `${location.origin}/auth/callback`;

export interface AppConfigShape {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly proxyBaseUrl: string;
  readonly scopes: ReadonlyArray<string>;
  // How many times a transient HTTP failure is retried. Configurable so tests
  // can disable backoff instead of driving a TestClock through it.
  readonly retryTimes: number;
  // Upper bound on concurrent Google API requests. A year load fans out per
  // calendar and per task list; unbounded fan-out would burst dozens of
  // simultaneous requests at Google's per-user quota on a busy account.
  readonly apiConcurrency: number;
}

export class AppConfig extends Context.Service<AppConfig, AppConfigShape>()("@julian/AppConfig") {}

export const appConfigLayer: Layer.Layer<AppConfig> = Layer.effect(
  AppConfig,
  Effect.gen(function* () {
    // A missing client id must not take down the runtime: the app still renders
    // the landing page and the year-view demo without credentials. Only the
    // OAuth flow needs it, and `GoogleAuth.start` reports the absence as a
    // typed `AuthConfigError` at the point the user actually tries to sign in.
    const clientId = yield* Config.string("VITE_GOOGLE_CLIENT_ID").pipe(Config.withDefault(""));
    const proxyBaseUrl = yield* Config.string("VITE_OAUTH_PROXY_BASE").pipe(
      Config.withDefault("/api/oauth"),
    );
    const redirectUri = yield* Config.string("VITE_GOOGLE_REDIRECT_URI").pipe(
      Config.withDefault(defaultRedirectUri()),
    );

    const retryTimes = yield* Config.int("VITE_HTTP_RETRY_TIMES").pipe(Config.withDefault(3));
    const apiConcurrency = yield* Config.int("VITE_API_CONCURRENCY").pipe(Config.withDefault(8));

    return AppConfig.of({
      clientId,
      redirectUri,
      proxyBaseUrl,
      scopes: DEFAULT_SCOPES,
      retryTimes,
      apiConcurrency,
    });
  }).pipe(Effect.orDie),
);

// Convenience for tests and stories that need a concrete configuration.
export const appConfigLayerWith = (overrides?: Partial<AppConfigShape>): Layer.Layer<AppConfig> =>
  Layer.succeed(AppConfig, {
    clientId: "test-client-id",
    redirectUri: "http://localhost:3000/auth/callback",
    proxyBaseUrl: "/api/oauth",
    scopes: DEFAULT_SCOPES,
    retryTimes: 0,
    apiConcurrency: 8,
    ...overrides,
  });
