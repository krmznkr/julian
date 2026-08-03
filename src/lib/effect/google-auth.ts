// Google OAuth (PKCE) as an Effect service.
//
// The flow is split out from the calendar API so the two concerns have separate
// owners: this module knows about authorization codes, PKCE verifiers and
// redirects; the calendar module knows about events. Navigation and storage are
// injected, so the redirect URL can be asserted in tests without stubbing
// globals.
import { Context, Effect, Layer, Option } from "effect";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { AuthConfigError, GoogleApiError } from "@/lib/effect/errors";
import { googleApiError } from "@/lib/effect/http-errors";
import * as S from "@/lib/effect/schemas";
import { STORAGE_KEYS } from "@/lib/effect/token-store";
import { AppConfig } from "@/lib/effect/config";
import { KeyValueStore } from "@/lib/effect/key-value-store";
import { Navigation } from "@/lib/effect/navigation";
import { TokenStore } from "@/lib/effect/token-store";

const PKCE_CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";

// Cryptographically-random PKCE verifier (RFC 7636). Uses `getRandomValues`
// rather than `Math.random` so the verifier is unpredictable.
const generateVerifier = (length = 64): Effect.Effect<string> =>
  Effect.sync(() => {
    const values = new Uint8Array(length);
    crypto.getRandomValues(values);
    return Array.from(values, (byte) => PKCE_CHARSET.charAt(byte % PKCE_CHARSET.length)).join("");
  });

const challengeFor = (verifier: string): Effect.Effect<string> =>
  Effect.promise(async () => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    const binary = String.fromCharCode(...new Uint8Array(digest));
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  });

export interface GoogleAuthShape {
  // Begin the OAuth redirect dance.
  readonly start: Effect.Effect<void, AuthConfigError>;
  // Complete it with the authorization code Google redirected back with.
  readonly handleCallback: (
    code: string,
    redirectUri?: string,
  ) => Effect.Effect<void, AuthConfigError | GoogleApiError>;
  readonly isAuthenticated: Effect.Effect<boolean, GoogleApiError>;
  readonly logout: Effect.Effect<void>;
}

export class GoogleAuth extends Context.Service<GoogleAuth, GoogleAuthShape>()(
  "@julian/GoogleAuth",
) {}

export const googleAuthLayer: Layer.Layer<
  GoogleAuth,
  never,
  AppConfig | KeyValueStore | Navigation | TokenStore | HttpClient.HttpClient
> = Layer.effect(
  GoogleAuth,
  Effect.gen(function* () {
    const config = yield* AppConfig;
    const store = yield* KeyValueStore;
    const navigation = yield* Navigation;
    const tokens = yield* TokenStore;
    const httpClient = yield* HttpClient.HttpClient;

    const client = httpClient.pipe(HttpClient.filterStatusOk);

    const buildAuthUrl = (codeChallenge: string): string => {
      const params = new URLSearchParams([
        ["client_id", config.clientId],
        ["redirect_uri", config.redirectUri],
        ["response_type", "code"],
        ["scope", config.scopes.join(" ")],
        ["code_challenge", codeChallenge],
        ["code_challenge_method", "S256"],
        ["prompt", "consent"],
        ["access_type", "offline"],
      ]);
      return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    };

    const start = Effect.gen(function* () {
      if (config.clientId.length === 0) {
        return yield* new AuthConfigError({
          message: "Missing VITE_GOOGLE_CLIENT_ID. Set it in .env and rebuild.",
        });
      }

      const verifier = yield* generateVerifier();
      const challenge = yield* challengeFor(verifier);

      yield* store.set(STORAGE_KEYS.codeVerifier, verifier);
      yield* navigation.assign(buildAuthUrl(challenge));
    });

    const handleCallback: GoogleAuthShape["handleCallback"] = Effect.fn(
      "GoogleAuth.handleCallback",
    )(function* (code: string, redirectUri?: string) {
      const verifier = yield* store.get(STORAGE_KEYS.codeVerifier);
      if (Option.isNone(verifier)) {
        return yield* new AuthConfigError({
          message: "No code verifier found. Please try logging in again.",
        });
      }

      const request = HttpClientRequest.post(`${config.proxyBaseUrl}/token`).pipe(
        HttpClientRequest.bodyJsonUnsafe({
          code,
          code_verifier: verifier.value,
          redirect_uri: redirectUri ?? config.redirectUri,
        }),
      );

      const response = yield* client.execute(request).pipe(
        Effect.flatMap(HttpClientResponse.schemaBodyJson(S.TokenResponse)),
        googleApiError(
          "GoogleAuth.handleCallback",
          "Failed to exchange authorization code for token",
        ),
        Effect.tapError((error) =>
          Effect.logError("Token exchange failed").pipe(Effect.annotateLogs({ error })),
        ),
      );

      yield* tokens.persist(response);
      yield* store.remove(STORAGE_KEYS.codeVerifier);
    });

    return GoogleAuth.of({
      start,
      handleCallback,
      isAuthenticated: tokens.current.pipe(Effect.map(Option.isSome)),
      logout: tokens.clear,
    });
  }),
);
