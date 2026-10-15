// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "./env";
import { serve } from "./pipeline";

const ORIGIN = "https://julian.krmznkr.com";

const allow = { limit: async () => ({ success: true }) };

const makeEnv = (assets: Env["ASSETS"]["fetch"]): Env => ({
  ASSETS: { fetch: assets },
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
  SITE_RATELIMIT: allow,
  OAUTH_RATELIMIT: allow,
});

const echoAssets = () =>
  vi.fn<Env["ASSETS"]["fetch"]>(
    async (request) =>
      new Response(`asset ${new URL(request.url).pathname}`, {
        headers: { "Content-Type": "text/html", "Cache-Control": "public, max-age=60" },
      }),
  );

const get = (path: string, cookie?: string) =>
  new Request(`${ORIGIN}${path}`, {
    headers: { "User-Agent": "Mozilla/5.0", ...(cookie === undefined ? {} : { Cookie: cookie }) },
  });

describe("site routing", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2027-01-01T08:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("serves the marketing landing at / to a first-time visitor", async () => {
    const assets = echoAssets();
    const response = await serve(get("/"), makeEnv(assets));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset /home");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(response.headers.get("Content-Type")).toBe("text/html");
    expect(response.headers.get("Content-Security-Policy")).not.toBeNull();
  });

  it("sends a returning visitor from / to the current year", async () => {
    const assets = echoAssets();
    const response = await serve(get("/", "theme=dark; julian_session=1"), makeEnv(assets));
    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe("/2027");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    expect(assets).not.toHaveBeenCalled();
  });

  it("ignores an empty session hint", async () => {
    const response = await serve(get("/", "julian_session="), makeEnv(echoAssets()));
    expect(response.status).toBe(200);
  });

  it.each([
    ["/year/2026", "/2026"],
    ["/year/2026?month=3&day=10", "/2026?month=3&day=10"],
    ["/year/2026/03", "/2026/03"],
  ])("permanently redirects the legacy %s to %s", async (path, location) => {
    const assets = echoAssets();
    const response = await serve(get(path, "julian_session=1"), makeEnv(assets));
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toBe(location);
    expect(assets).not.toHaveBeenCalled();
  });

  it.each(["/home", "/privacy", "/terms", "/2026", "/2026/03", "/demo/2026", "/year/abc"])(
    "hands %s to the assets binding unchanged",
    async (path) => {
      const assets = echoAssets();
      const response = await serve(get(path, "julian_session=1"), makeEnv(assets));
      expect(response.status).toBe(200);
      expect(await response.text()).toBe(`asset ${path}`);
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    },
  );
});
