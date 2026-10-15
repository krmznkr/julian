// OAuth token proxy: the only place the Google client secret is used.
//
// The browser posts a PKCE code (or a refresh token) here, and this module adds
// the server-held client credentials and forwards the request to Google. The
// secret therefore never ships in the browser bundle.
import { Effect, Redacted, Schema } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import { WorkerEnv } from "./env";
import { rejectOAuth } from "./errors";
import { enforceOAuthRateLimit } from "./guards";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

// Only the app's own origins may call the proxy, so cross-site pages are
// rejected before we ever talk to Google. Local dev servers are allowed only
// on the dev channel. This is browser hygiene, not authentication: a non-browser
// client can send any Origin it likes.
const DEPLOYED_ORIGINS = ["https://julian.krmznkr.com", "https://julian-nightly.krmznkr.com"];
const LOCAL_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
];

export const allowedOrigins = (channel: string): ReadonlySet<string> =>
  new Set(channel === "dev" ? [...DEPLOYED_ORIGINS, ...LOCAL_ORIGINS] : DEPLOYED_ORIGINS);

// OAuth JSON bodies are tiny; anything larger is abuse or a bug.
export const MAX_OAUTH_BODY_BYTES = 4096;

export const OAUTH_PREFIX = "/api/oauth/";

const TokenRequest = Schema.Struct({
  code: Schema.NonEmptyString,
  code_verifier: Schema.NonEmptyString,
  redirect_uri: Schema.NonEmptyString,
});

const RefreshRequest = Schema.Struct({
  refresh_token: Schema.NonEmptyString,
});

// Same-site browser POSTs only, with a sane declared body size.
const checkRequest = (request: Request, channel: string) => {
  if (request.method !== "POST") return Effect.fail(rejectOAuth(405, "method_not_allowed"));
  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins(channel).has(origin)) {
    return Effect.fail(rejectOAuth(403, "forbidden", "Origin not allowed"));
  }
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  return Number.isFinite(contentLength) && contentLength > MAX_OAUTH_BODY_BYTES
    ? Effect.fail(rejectOAuth(413, "payload_too_large"))
    : Effect.void;
};

const concat = (chunks: ReadonlyArray<Uint8Array>, size: number): Uint8Array =>
  chunks.reduce(
    (acc, chunk) => {
      acc.bytes.set(chunk, acc.offset);
      return { bytes: acc.bytes, offset: acc.offset + chunk.byteLength };
    },
    { bytes: new Uint8Array(size), offset: 0 },
  ).bytes;

// Streams the body and stops at the cap: Content-Length may be absent or lie.
const readCapped = (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  chunks: ReadonlyArray<Uint8Array> = [],
  size = 0,
): Effect.Effect<Uint8Array, ReturnType<typeof rejectOAuth>> =>
  Effect.tryPromise({
    try: () => reader.read(),
    catch: () => rejectOAuth(400, "bad_request", "Unreadable body"),
  }).pipe(
    Effect.flatMap(({ value, done }) => {
      if (done) return Effect.succeed(concat(chunks, size));
      const next = size + value.byteLength;
      return next > MAX_OAUTH_BODY_BYTES
        ? Effect.promise(() => reader.cancel()).pipe(
            Effect.andThen(Effect.fail(rejectOAuth(413, "payload_too_large"))),
          )
        : readCapped(reader, [...chunks, value], next);
    }),
  );

const readJsonBody = (request: Request) => {
  const stream = request.body;
  if (!stream) return Effect.fail(rejectOAuth(400, "invalid_request"));
  return Effect.acquireUseRelease(
    Effect.sync(() => stream.getReader()),
    (reader) => readCapped(reader),
    (reader) => Effect.sync(() => reader.releaseLock()),
  ).pipe(
    Effect.flatMap((bytes) =>
      Effect.try({
        try: (): unknown => JSON.parse(new TextDecoder().decode(bytes)),
        catch: () => rejectOAuth(400, "bad_request", "Invalid JSON body"),
      }),
    ),
  );
};

const decodeBody =
  <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S, description: string) =>
  (body: unknown) =>
    Schema.decodeUnknownEffect(schema)(body).pipe(
      Effect.mapError(() => rejectOAuth(400, "invalid_request", description)),
    );

// Forwards the grant to Google and passes its JSON body and status straight back.
const exchangeWithGoogle = Effect.fn("edge.exchangeWithGoogle")(function* (
  grant: Record<string, string>,
) {
  const env = yield* WorkerEnv;
  const params = {
    client_id: env.googleClientId,
    client_secret: Redacted.value(env.googleClientSecret),
    ...grant,
  };
  const response = yield* HttpClient.execute(
    HttpClientRequest.post(GOOGLE_TOKEN_ENDPOINT).pipe(HttpClientRequest.bodyUrlParams(params)),
  ).pipe(Effect.mapError(() => rejectOAuth(502, "upstream_unavailable", "Could not reach Google")));
  const text = yield* response.text.pipe(
    Effect.mapError(() => rejectOAuth(502, "upstream_unavailable", "Could not read Google")),
  );
  return new Response(text, {
    status: response.status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
});

export const handleOAuth = Effect.fn("edge.oauth")(function* (request: Request) {
  const { pathname } = new URL(request.url);
  const env = yield* WorkerEnv;
  yield* checkRequest(request, env.build.channel);
  yield* enforceOAuthRateLimit(request);

  if (Redacted.value(env.googleClientSecret) === "") {
    return yield* rejectOAuth(500, "server_misconfigured", "GOOGLE_CLIENT_SECRET is not set");
  }

  if (pathname === "/api/oauth/token") {
    const body = yield* readJsonBody(request).pipe(
      Effect.flatMap(decodeBody(TokenRequest, "Missing code/code_verifier/redirect_uri")),
    );
    return yield* exchangeWithGoogle({ ...body, grant_type: "authorization_code" });
  }
  if (pathname === "/api/oauth/refresh") {
    const body = yield* readJsonBody(request).pipe(
      Effect.flatMap(decodeBody(RefreshRequest, "Missing refresh_token")),
    );
    return yield* exchangeWithGoogle({ ...body, grant_type: "refresh_token" });
  }
  return yield* rejectOAuth(404, "not_found");
});
