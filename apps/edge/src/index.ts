// Cloudflare Worker for julian.krmznkr.com.
//
// It serves the static SPA (via the ASSETS binding) and proxies the Google OAuth
// token exchange so the client secret never reaches the browser.
//
// The request pipeline is one Effect program:
//   1. drop known scrapers and scripting clients        (guards.ts)
//   2. whole-site rate limit per client IP              (guards.ts)
//   3. /api/oauth/*: origin lock, tight rate limit,
//      capped body, schema-validated grant, Google call (oauth.ts)
//   4. everything else: static assets
// Any rejection is a tagged error (errors.ts) rendered by `toResponse`, and
// every response leaves with the hardening headers from @julian/security.
import { SECURITY_HEADERS } from "@julian/security";
import { Effect, Layer } from "effect";
import { FetchHttpClient } from "effect/http";
import { WorkerEnv, workerEnvLayer, type Env } from "./env";
import type { EdgeError } from "./errors";
import { enforceSiteRateLimit, rejectBots } from "./guards";
import { OAUTH_PREFIX, handleOAuth } from "./oauth";

// Copies a response and layers the hardening headers on top. Existing headers
// (content-type, cache-control from the assets binding, etc.) are preserved.
export const withSecurityHeaders = (response: Response): Response => {
  const headers = new Headers(response.headers);
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

const json = (data: unknown, status: number): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

export const toResponse = (error: EdgeError): Response => {
  switch (error._tag) {
    case "BlockedClient":
      return new Response("Forbidden", { status: 403 });
    case "SiteRateLimited":
      return new Response("Too Many Requests", { status: 429 });
    case "OAuthRejected":
      return json(
        error.description === undefined
          ? { error: error.error }
          : { error: error.error, error_description: error.description },
        error.status,
      );
  }
};

const serveAsset = Effect.fn("edge.asset")(function* (request: Request) {
  const env = yield* WorkerEnv;
  // index.html fallback is handled by the assets binding's SPA not_found_handling.
  return yield* Effect.promise(() => env.assets.fetch(request));
});

export const handle = Effect.fn("edge.request")(function* (request: Request) {
  yield* rejectBots(request);
  yield* enforceSiteRateLimit(request);
  return new URL(request.url).pathname.startsWith(OAUTH_PREFIX)
    ? yield* handleOAuth(request)
    : yield* serveAsset(request);
});

// `fetchImpl` is the outbound fetch used for Google; tests pass a fake.
export const serve = (
  request: Request,
  env: Env,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<Response> =>
  handle(request).pipe(
    Effect.catch((error) => Effect.succeed(toResponse(error))),
    Effect.map(withSecurityHeaders),
    Effect.provide(
      Layer.mergeAll(
        workerEnvLayer(env),
        FetchHttpClient.layer,
        Layer.succeed(FetchHttpClient.Fetch, fetchImpl),
      ),
    ),
    Effect.runPromise,
  );

export default {
  fetch: (request: Request, env: Env): Promise<Response> => serve(request, env),
};
