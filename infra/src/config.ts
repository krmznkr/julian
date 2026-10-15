// Single source of truth for the Cloudflare setup. The Alchemy stack reads it
// directly; apps/edge/wrangler.jsonc is rendered from it (see wrangler.ts).

export const ACCOUNT_ID = "93527c9983d1c08638cb9c1de99f0450";
export const ZONE_NAME = "krmznkr.com";
export const COMPATIBILITY_DATE = "2026-07-04";

export const GOOGLE_CLIENT_ID =
  "151900009012-fevbjvlejmju4lva9brr5lmufp5q4g0s.apps.googleusercontent.com";

// Worker secrets, set out of band (never in config or state).
export const WORKER_SECRETS = ["GOOGLE_CLIENT_SECRET"] as const;

/** Assets directory, relative to apps/edge. */
export const ASSETS_DIRECTORY = "../web/dist";

export interface RateLimit {
  readonly binding: string;
  readonly namespaceId: string;
  readonly limit: number;
  readonly period: 10 | 60;
}

export const RATE_LIMITS: ReadonlyArray<RateLimit> = [
  // Whole-site abuse cap: generous for humans, throttles volumetric scraping.
  { binding: "SITE_RATELIMIT", namespaceId: "1001", limit: 240, period: 60 },
  // Tight cap on the OAuth proxy so nobody can hammer Google through it.
  { binding: "OAUTH_RATELIMIT", namespaceId: "1002", limit: 12, period: 60 },
];

export type Channel = "stable" | "nightly";

export interface WorkerConfig {
  readonly name: string;
  readonly domain: string;
  /** Default APP_CHANNEL; each deploy overrides the APP_* vars. */
  readonly channel: "dev" | "nightly";
  /** Version preview URLs back the PR previews (stable only). */
  readonly previewUrls: boolean;
}

export const WORKERS: Readonly<Record<Channel, WorkerConfig>> = {
  stable: {
    name: "julian",
    domain: `julian.${ZONE_NAME}`,
    channel: "dev",
    previewUrls: true,
  },
  nightly: {
    name: "julian-nightly",
    domain: `julian-nightly.${ZONE_NAME}`,
    channel: "nightly",
    previewUrls: false,
  },
};
