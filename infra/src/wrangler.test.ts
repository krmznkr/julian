import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RATE_LIMITS, WORKERS, WORKER_SECRETS } from "./config.ts";
import { renderWranglerConfig, WRANGLER_CONFIG_PATH, wranglerConfig } from "./wrangler.ts";

const checkedIn = readFileSync(
  fileURLToPath(new URL(`../../${WRANGLER_CONFIG_PATH}`, import.meta.url)),
  "utf8",
);

describe("config", () => {
  it("uses periods the rate limiting binding accepts and distinct namespaces", () => {
    expect(RATE_LIMITS.every((limit) => limit.period === 10 || limit.period === 60)).toBe(true);
    const ids = RATE_LIMITS.flatMap((limit) => Object.values(limit.namespaceIds));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the documented limits", () => {
    expect(RATE_LIMITS.map(({ binding, limit, period }) => [binding, limit, period])).toEqual([
      ["SITE_RATELIMIT", 240, 60],
      ["OAUTH_RATELIMIT", 12, 60],
    ]);
  });

  it("gives each channel its own Worker and domain", () => {
    expect(WORKERS.stable.domain).toBe("julian.krmznkr.com");
    expect(WORKERS.nightly.domain).toBe("julian-nightly.krmznkr.com");
    expect(WORKERS.stable.name).not.toBe(WORKERS.nightly.name);
  });
});

describe("wranglerConfig", () => {
  const config = wranglerConfig();

  it("routes every request through the Worker with an SPA fallback", () => {
    expect(config.assets).toMatchObject({
      directory: "../web/dist",
      not_found_handling: "single-page-application",
      run_worker_first: true,
    });
  });

  it("repeats vars, rate limits and routes for nightly", () => {
    expect(config.env.nightly.ratelimits.map(({ name, simple }) => ({ name, simple }))).toEqual(
      config.ratelimits.map(({ name, simple }) => ({ name, simple })),
    );
    expect(config.env.nightly.ratelimits.map((limit) => limit.namespace_id)).toEqual([
      "2001",
      "2002",
    ]);
    expect(config.env.nightly.vars.GOOGLE_CLIENT_ID).toBe(config.vars.GOOGLE_CLIENT_ID);
    expect(config.env.nightly).toMatchObject({
      name: "julian-nightly",
      preview_urls: false,
      vars: { APP_CHANNEL: "nightly" },
      routes: [{ pattern: "julian-nightly.krmznkr.com", custom_domain: true }],
    });
    expect(config).toMatchObject({
      name: "julian",
      preview_urls: true,
      workers_dev: false,
      vars: { APP_CHANNEL: "dev" },
      routes: [{ pattern: "julian.krmznkr.com", custom_domain: true }],
    });
  });

  it("never carries a secret", () => {
    const rendered = renderWranglerConfig();
    expect(rendered).not.toMatch(/GOCSPX-/);
    expect(WORKER_SECRETS.every((name) => !rendered.includes(name))).toBe(true);
  });

  it("matches the checked-in apps/edge/wrangler.jsonc", () => {
    expect(checkedIn).toBe(renderWranglerConfig());
  });
});
