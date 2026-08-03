// OAuth token lifecycle as an Effect service.
//
// This was previously inlined into the calendar module, which meant the "get a
// valid access token, refreshing when near expiry" rule lived next to calendar
// pagination. Isolating it gives the refresh policy one owner and lets the HTTP
// layer depend on "a token" rather than on the whole calendar module.
import { Context, Effect, Layer, Option, Semaphore } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { GoogleApiError } from "@/lib/effect/errors";
import { googleApiError } from "@/lib/effect/http-errors";
import { okClientWithRetry } from "@/lib/effect/http-policy";
import * as S from "@/lib/effect/schemas";
import { AppConfig } from "@/lib/effect/config";
import { KeyValueStore } from "@/lib/effect/key-value-store";

// Refresh this far ahead of the real expiry so an in-flight request cannot
// straddle the boundary.
const EXPIRY_SKEW_MS = 60_000;

export const STORAGE_KEYS = {
  accessToken: "google:access_token",
  refreshToken: "google:refresh_token",
  expiresAt: "google:expires_at",
  codeVerifier: "google:pkce_verifier",
} as const;

export interface TokenStoreShape {
  // The current valid access token, refreshing when close to expiry.
  readonly current: Effect.Effect<Option.Option<string>, GoogleApiError>;
  // Persist a freshly issued token set.
  readonly persist: (response: S.TokenResponse) => Effect.Effect<void>;
  // Forget all stored credentials.
  readonly clear: Effect.Effect<void>;
}

export class TokenStore extends Context.Service<TokenStore, TokenStoreShape>()(
  "@julian/TokenStore",
) {}

export const tokenStoreLayer: Layer.Layer<
  TokenStore,
  never,
  AppConfig | KeyValueStore | HttpClient.HttpClient
> = Layer.effect(
  TokenStore,
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const store = yield* KeyValueStore;
    const httpClient = yield* HttpClient.HttpClient;

    // Token refresh is idempotent and the proxy is the app's own Worker, so a
    // bounded retry avoids bouncing the user to a re-login screen because of one
    // dropped request.
    const client = okClientWithRetry(httpClient, config.retryTimes);
    const refreshLock = yield* Semaphore.make(1);

    const persist = Effect.fn("TokenStore.persist")(function* (response: S.TokenResponse) {
      const expiresAt = String(Date.now() + response.expires_in * 1000);

      yield* Effect.all(
        [
          store.set(STORAGE_KEYS.accessToken, response.access_token),
          store.set(STORAGE_KEYS.expiresAt, expiresAt),
          response.refresh_token === undefined
            ? Effect.void
            : store.set(STORAGE_KEYS.refreshToken, response.refresh_token),
        ],
        { discard: true },
      );
    });

    const clear = Effect.all(
      [
        store.remove(STORAGE_KEYS.accessToken),
        store.remove(STORAGE_KEYS.refreshToken),
        store.remove(STORAGE_KEYS.expiresAt),
      ],
      { discard: true },
    );

    const refresh = Effect.fn("TokenStore.refresh")(
      function* () {
        const refreshToken = yield* store.get(STORAGE_KEYS.refreshToken);
        if (Option.isNone(refreshToken)) return Option.none<string>();

        const request = HttpClientRequest.post(`${config.proxyBaseUrl}/refresh`).pipe(
          HttpClientRequest.bodyJsonUnsafe({ refresh_token: refreshToken.value }),
        );

        const response = yield* client
          .execute(request)
          .pipe(
            Effect.flatMap(HttpClientResponse.schemaBodyJson(S.TokenResponse)),
            googleApiError("TokenStore.refresh", "Token refresh failed"),
          );

        yield* persist(response);
        return Option.some(response.access_token);
      },
      (effect) =>
        effect.pipe(
          // Only a 4xx means the refresh token itself is invalid or revoked: drop
          // it and report "no token" so the user re-authenticates. Transient
          // failures (network, 5xx, malformed body) stay in the error channel so
          // callers can distinguish "signed out" from "temporarily unavailable"
          // and avoid a needless forced logout.
          Effect.catchIf(
            (error: GoogleApiError) =>
              error.status !== undefined && error.status >= 400 && error.status < 500,
            () =>
              Effect.logInfo("Refresh token rejected; clearing stored credentials").pipe(
                Effect.andThen(clear),
                Effect.as(Option.none<string>()),
              ),
          ),
        ),
    );

    // Reads the stored token, returning `None` when it is absent or too close
    // to expiry to be worth using.
    const storedIfFresh = Effect.gen(function* () {
      const token = yield* store.get(STORAGE_KEYS.accessToken);
      const expiresAt = yield* store.get(STORAGE_KEYS.expiresAt);

      if (Option.isSome(token) && Option.isSome(expiresAt)) {
        const deadline = Number.parseInt(expiresAt.value, 10);
        if (Number.isFinite(deadline) && Date.now() < deadline - EXPIRY_SKEW_MS) {
          return token;
        }
      }
      return Option.none<string>();
    });

    const current = Effect.gen(function* () {
      const fresh = yield* storedIfFresh;
      if (Option.isSome(fresh)) return fresh;

      // Single-flight refresh. A year load fans out many authorized requests at
      // once; without this, every one of them would find the token expired and
      // POST its own `/refresh`. That bursts the proxy, races the `persist`
      // writes so the stored token depends on completion order, and — because
      // Google rotates refresh tokens — lets a losing response persist a token
      // the server has already invalidated.
      return yield* Semaphore.withPermit(refreshLock)(
        Effect.gen(function* () {
          // Re-check inside the critical section: whoever held the lock has
          // already refreshed, so waiters reuse that result instead of
          // refreshing again.
          const afterWait = yield* storedIfFresh;
          if (Option.isSome(afterWait)) return afterWait;
          return yield* refresh();
        }),
      );
    });

    return TokenStore.of({ current, persist, clear });
  }),
);
