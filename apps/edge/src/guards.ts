// Request guards that run before any real work: bot filter and rate limits.
import { Effect } from "effect";
import { WorkerEnv, type RateLimiter } from "./env";
import { BlockedClient, SiteRateLimited, rejectOAuth } from "./errors";

// Aggressive SEO/scraper/AI bots and generic scripting clients that add load
// and ignore robots.txt. Matched case-insensitively as substrings of the UA.
// Well-behaved browsers and social link-preview bots (LinkedIn/Slack/etc.) are
// intentionally NOT here, so sharing the link from a resume still works.
export const BLOCKED_USER_AGENTS: ReadonlyArray<string> = [
  "ahrefsbot",
  "semrushbot",
  "mj12bot",
  "dotbot",
  "petalbot",
  "bytespider",
  "dataforseobot",
  "blexbot",
  "barkrowler",
  "zoominfobot",
  "serpstatbot",
  "megaindex",
  "seekbot",
  "gigabot",
  "python-requests",
  "scrapy",
  "go-http-client",
  "libwww-perl",
  "java/",
  "curl/",
  "wget/",
  "masscan",
  "zgrab",
  "nikto",
  "sqlmap",
];

// Best-effort client identity for rate limiting. Cloudflare always sets
// CF-Connecting-IP at the edge; the fallback keeps `wrangler dev` working.
export const clientIp = (request: Request): string =>
  request.headers.get("CF-Connecting-IP") ?? "0.0.0.0";

// A missing UA is treated as a bot too: real browsers always send one.
export const rejectBots = (request: Request): Effect.Effect<void, BlockedClient> => {
  const ua = (request.headers.get("User-Agent") ?? "").toLowerCase();
  return ua === "" || BLOCKED_USER_AGENTS.some((bot) => ua.includes(bot))
    ? Effect.fail(new BlockedClient())
    : Effect.void;
};

const withinLimit = (limiter: RateLimiter, key: string) =>
  Effect.promise(() => limiter.limit({ key })).pipe(Effect.map(({ success }) => success));

// Whole-site cap per client IP (volumetric abuse protection).
export const enforceSiteRateLimit = Effect.fn("edge.siteRateLimit")(function* (request: Request) {
  const env = yield* WorkerEnv;
  if (!(yield* withinLimit(env.siteRateLimit, clientIp(request)))) {
    return yield* new SiteRateLimited();
  }
});

// Much tighter cap on the credential-exchange endpoints.
export const enforceOAuthRateLimit = Effect.fn("edge.oauthRateLimit")(function* (request: Request) {
  const env = yield* WorkerEnv;
  if (!(yield* withinLimit(env.oauthRateLimit, clientIp(request)))) {
    return yield* rejectOAuth(429, "rate_limited", "Too many requests");
  }
});
