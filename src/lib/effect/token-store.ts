import { Context, Effect, Layer, Option, Semaphore } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { GoogleApiError } from "@/lib/effect/errors";
import { googleApiError } from "@/lib/effect/http-errors";
import { retryingClient } from "@/lib/effect/http-policy";
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
    const client = retryingClient(httpClient, config.retryTimes);
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

    const refresh = Effect.fn("TokenStore.refresh")(function* () {
      const refreshToken = yield* store.get(STORAGE_KEYS.refreshToken);
      if (Option.isNone(refreshToken)) return Option.none<string>();

      const request = HttpClientRequest.post(`${config.proxyBaseUrl}/refresh`).pipe(
        HttpClientRequest.bodyJsonUnsafe({ refresh_token: refreshToken.value }),
      );

      const response = yield* client
        .execute(request)
        .pipe(googleApiError("TokenStore.refresh", "Token refresh failed"));
      if (response.status < 200 || response.status >= 300) {
        const body = yield* HttpClientResponse.schemaBodyJson(S.OAuthErrorResponse)(response).pipe(
          Effect.orElseSucceed(() => ({ error: "unknown" })),
        );
        // Only invalid_grant means the user's refresh token was rejected.
        if (response.status === 400 && body.error === "invalid_grant") {
          yield* clear;
          return Option.none<string>();
        }
        return yield* new GoogleApiError({
          operation: "TokenStore.refresh",
          message: "Token refresh failed",
          status: response.status,
          cause: body,
        });
      }
      const token = yield* HttpClientResponse.schemaBodyJson(S.TokenResponse)(response).pipe(
        googleApiError("TokenStore.refresh", "Invalid token response"),
      );
      yield* persist(token);
      return Option.some(token.access_token);
    });

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
