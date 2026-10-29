// The live configuration layer: env reads, defaults and the derived redirect URI.
//
// The env comes from an explicit `ConfigProvider` so no test depends on the
// shell or on `import.meta.env`. `location` is stubbed per case because the
// redirect URI default is derived from the serving origin.
import { afterEach, describe, expect, vi } from "vitest";
import { it } from "@effect/vitest";
import { ConfigProvider, Effect, Exit, Layer } from "effect";
import { AppConfig, GOOGLE_SCOPES, appConfigLayer } from "./config";

const loadConfig = (env: Record<string, string | undefined>) =>
  Effect.gen(function* () {
    return yield* AppConfig;
  }).pipe(
    Effect.provide(
      appConfigLayer.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))),
    ),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("appConfigLayer", () => {
  it.effect("falls back to defaults when nothing is configured", () =>
    Effect.gen(function* () {
      const config = yield* loadConfig({});

      // A missing client id is not fatal; sign-in reports it later.
      expect(config.clientId).toBe("");
      expect(config.proxyBaseUrl).toBe("/api/oauth");
      expect(config.retryTimes).toBe(3);
      expect(config.apiConcurrency).toBe(8);
      expect(config.scopes).toEqual(GOOGLE_SCOPES);
    }),
  );

  it.effect("derives the redirect URI from the serving origin", () =>
    Effect.gen(function* () {
      vi.stubGlobal("location", { origin: "https://preview.julian.example" });

      const config = yield* loadConfig({});

      expect(config.redirectUri).toBe("https://preview.julian.example/auth/callback");
    }),
  );

  it.effect("uses the localhost redirect URI when there is no location", () =>
    Effect.gen(function* () {
      expect(typeof location).toBe("undefined");

      const config = yield* loadConfig({});

      expect(config.redirectUri).toBe("http://localhost:3000/auth/callback");
    }),
  );

  it.effect("reads every value from the environment when set", () =>
    Effect.gen(function* () {
      vi.stubGlobal("location", { origin: "https://ignored.example" });

      const config = yield* loadConfig({
        VITE_GOOGLE_CLIENT_ID: "client-123.apps.googleusercontent.com",
        VITE_OAUTH_PROXY_BASE: "https://proxy.example/api/oauth",
        VITE_GOOGLE_REDIRECT_URI: "https://julian.example/auth/callback",
        VITE_HTTP_RETRY_TIMES: "0",
        VITE_API_CONCURRENCY: "2",
      });

      expect(config).toEqual({
        clientId: "client-123.apps.googleusercontent.com",
        proxyBaseUrl: "https://proxy.example/api/oauth",
        redirectUri: "https://julian.example/auth/callback",
        scopes: GOOGLE_SCOPES,
        retryTimes: 0,
        apiConcurrency: 2,
      });
    }),
  );

  it.effect("dies on a malformed number instead of guessing", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(loadConfig({ VITE_HTTP_RETRY_TIMES: "lots" }));

      expect(Exit.hasDies(exit)).toBe(true);
    }),
  );
});
