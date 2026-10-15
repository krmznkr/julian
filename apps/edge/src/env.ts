// The Worker's bindings as an Effect service.
//
// Handlers depend on `WorkerEnv` instead of receiving `env` as an argument, so a
// test provides a fake layer and production provides the real bindings per
// request. The client secret is wrapped in `Redacted` the moment it enters the
// program, so it cannot leak through logs, traces, or error messages.
import { Context, Layer, Redacted } from "effect";

// The native Workers rate-limiting binding: limit({ key }) -> { success }.
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

// Shape of the raw bindings Cloudflare passes to `fetch`.
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  SITE_RATELIMIT: RateLimiter;
  OAUTH_RATELIMIT: RateLimiter;
  // Build metadata, set per deploy with `wrangler --var` (see docs/releasing.md).
  APP_VERSION?: string;
  APP_CHANNEL?: string;
  APP_COMMIT?: string;
}

export interface BuildInfo {
  readonly version: string;
  readonly channel: string;
  readonly commit: string;
}

export interface WorkerEnvShape {
  readonly assets: Env["ASSETS"];
  readonly googleClientId: string;
  // An unset secret becomes an empty value: it is reported per request as
  // `server_misconfigured`, not as a crash at startup.
  readonly googleClientSecret: Redacted.Redacted<string>;
  readonly siteRateLimit: RateLimiter;
  readonly oauthRateLimit: RateLimiter;
  readonly build: BuildInfo;
}

export class WorkerEnv extends Context.Service<WorkerEnv, WorkerEnvShape>()(
  "@julian/edge/WorkerEnv",
) {}

export const workerEnvLayer = (env: Env): Layer.Layer<WorkerEnv> =>
  Layer.succeed(
    WorkerEnv,
    WorkerEnv.of({
      assets: env.ASSETS,
      googleClientId: env.GOOGLE_CLIENT_ID,
      googleClientSecret: Redacted.make(env.GOOGLE_CLIENT_SECRET ?? "", {
        label: "GOOGLE_CLIENT_SECRET",
      }),
      siteRateLimit: env.SITE_RATELIMIT,
      oauthRateLimit: env.OAUTH_RATELIMIT,
      build: {
        version: env.APP_VERSION || "unknown",
        channel: env.APP_CHANNEL || "dev",
        commit: env.APP_COMMIT || "unknown",
      },
    }),
  );
