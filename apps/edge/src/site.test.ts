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

  it.each([
    "/home",
    "/privacy",
    "/terms",
    "/2026",
    "/2026/03",
    "/year/abc",
    "/demo",
    "/demo/",
    "/demo-other",
    "/democracy",
    "/calendar",
    "/auth/callback",
  ])("hands %s to the assets binding unchanged", async (path) => {
    const assets = echoAssets();
    const response = await serve(get(path, "julian_session=1"), makeEnv(assets));
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(`asset ${path}`);
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
  });

  it.each([
    ["/demo/2026", ""],
    ["/demo/2026/", ""],
    ["/demo/2026/03", ""],
    ["/demo/2026", "?month=10&day=27&details=false"],
    ["/demo/2026/03", "?month=3&day=10"],
  ])("serves the /demo page for the deep demo link %s%s", async (path, search) => {
    const assets = echoAssets();
    const response = await serve(get(`${path}${search}`, "julian_session=1"), makeEnv(assets));
    expect(response.status).toBe(200);
    expect(response.headers.get("Location")).toBeNull();
    expect(await response.text()).toBe("asset /demo");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=60");
    expect(response.headers.get("Content-Security-Policy")).not.toBeNull();
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(assets).toHaveBeenCalledOnce();
    const [forwarded] = assets.mock.calls[0] ?? [];
    expect(forwarded?.url).toBe(`${ORIGIN}/demo${search}`);
    expect(forwarded?.headers.get("Cookie")).toBe("julian_session=1");
    expect(forwarded?.headers.get("User-Agent")).toBe("Mozilla/5.0");
  });

  it("keeps the method of a HEAD request for a deep demo link", async () => {
    const assets = vi.fn<Env["ASSETS"]["fetch"]>(
      async () => new Response(null, { headers: { "Content-Type": "text/html" } }),
    );
    const response = await serve(
      new Request(`${ORIGIN}/demo/2026`, {
        method: "HEAD",
        headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
      }),
      makeEnv(assets),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/html");
    const [forwarded] = assets.mock.calls[0] ?? [];
    expect(forwarded?.method).toBe("HEAD");
    expect(new URL(forwarded?.url ?? "").pathname).toBe("/demo");
  });

  it.each([
    "/demo/nope.js",
    "/demo/2026/app.css",
    "/demo/.env",
    "/demo/.git/config",
    "/demo/_headers",
  ])("keeps the 404 for a non-navigation request to the missing file %s", async (path) => {
    const assets = echoAssets();
    const response = await serve(
      new Request(`${ORIGIN}${path}`, {
        headers: { "User-Agent": "Mozilla/5.0", "Sec-Fetch-Mode": "no-cors" },
      }),
      makeEnv(assets),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Security-Policy")).not.toBeNull();
    expect(new URL(assets.mock.calls[0]?.[0].url ?? "").pathname).toBe(path);
  });

  it("does not turn a navigation to a file-like demo path into the demo page", async () => {
    const response = await serve(
      new Request(`${ORIGIN}/demo/nope.js`, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html,*/*" },
      }),
      makeEnv(echoAssets()),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset /demo/nope.js");
  });

  it("serves an existing file below /demo as it is", async () => {
    const assets = vi.fn<Env["ASSETS"]["fetch"]>(
      async () => new Response("png", { headers: { "Content-Type": "image/png" } }),
    );
    const response = await serve(
      new Request(`${ORIGIN}/demo/shot.png`, {
        headers: { "User-Agent": "Mozilla/5.0", "Sec-Fetch-Mode": "no-cors" },
      }),
      makeEnv(assets),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(new URL(assets.mock.calls[0]?.[0].url ?? "").pathname).toBe("/demo/shot.png");
  });

  it.each(["", "curl/8.0", "Mozilla/5.0 (compatible; AhrefsBot/7.0)"])(
    "still blocks %j on a deep demo link before any asset fetch",
    async (ua) => {
      const assets = echoAssets();
      const response = await serve(
        new Request(`${ORIGIN}/demo/2026?month=10`, { headers: { "User-Agent": ua } }),
        makeEnv(assets),
      );
      expect(response.status).toBe(403);
      expect(response.headers.get("Content-Security-Policy")).not.toBeNull();
      expect(assets).not.toHaveBeenCalled();
    },
  );

  it("still rate limits a deep demo link before any asset fetch", async () => {
    const assets = echoAssets();
    const response = await serve(get("/demo/2026"), {
      ...makeEnv(assets),
      SITE_RATELIMIT: { limit: async () => ({ success: false }) },
    });
    expect(response.status).toBe(429);
    expect(assets).not.toHaveBeenCalled();
  });

  it.each(["/nope.js", "/robots.txt", "/_headers", "/.env", "/.git/config", "/assets/missing.css"])(
    "answers a non-navigation request for the missing file %s with 404",
    async (path) => {
      const response = await serve(
        new Request(`${ORIGIN}${path}`, {
          headers: { "User-Agent": "Mozilla/5.0", "Sec-Fetch-Mode": "no-cors" },
        }),
        makeEnv(echoAssets()),
      );
      expect(response.status).toBe(404);
      expect(response.headers.get("Content-Security-Policy")).not.toBeNull();
    },
  );

  it("keeps the SPA fallback for a navigation to a file-like path", async () => {
    const response = await serve(
      new Request(`${ORIGIN}/nope.js`, {
        headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html,*/*" },
      }),
      makeEnv(echoAssets()),
    );
    expect(response.status).toBe(200);
  });

  it("serves an existing non-HTML file to a script request", async () => {
    const assets = vi.fn<Env["ASSETS"]["fetch"]>(
      async () => new Response("x", { headers: { "Content-Type": "text/javascript" } }),
    );
    const response = await serve(
      new Request(`${ORIGIN}/assets/app.js`, {
        headers: { "User-Agent": "Mozilla/5.0", "Sec-Fetch-Mode": "no-cors" },
      }),
      makeEnv(assets),
    );
    expect(response.status).toBe(200);
  });

  it("treats a request without fetch metadata or Accept as a file request", async () => {
    const assets = vi.fn<Env["ASSETS"]["fetch"]>(async () => new Response("index"));
    const missing = await serve(
      new Request(`${ORIGIN}/nope.js`, { headers: { "User-Agent": "Mozilla/5.0" } }),
      makeEnv(assets),
    );
    expect(missing.status).toBe(200);
    const html = await serve(get("/nope.js"), makeEnv(echoAssets()));
    expect(html.status).toBe(404);
  });

  it.each([
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "LinkedInBot/1.0 (compatible; Mozilla/5.0; Apache-HttpClient +http://www.linkedin.com)",
    "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
    "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)",
    "Twitterbot/1.0",
  ])(
    "lets the link-preview bot %j fetch /demo, a deep demo link and the share image",
    async (ua) => {
      const assets = vi.fn<Env["ASSETS"]["fetch"]>(async (request) =>
        new URL(request.url).pathname === "/og-image.png"
          ? new Response("png", { headers: { "Content-Type": "image/png" } })
          : new Response(`page ${new URL(request.url).pathname}`, {
              headers: { "Content-Type": "text/html" },
            }),
      );
      const page = await serve(
        new Request(`${ORIGIN}/demo`, { headers: { "User-Agent": ua, Accept: "text/html" } }),
        makeEnv(assets),
      );
      expect(page.status).toBe(200);
      const deep = await serve(
        new Request(`${ORIGIN}/demo/2026?month=10&day=27&details=false`, {
          headers: { "User-Agent": ua, Accept: "text/html" },
        }),
        makeEnv(assets),
      );
      expect(deep.status).toBe(200);
      expect(await deep.text()).toBe("page /demo");
      const image = await serve(
        new Request(`${ORIGIN}/og-image.png`, { headers: { "User-Agent": ua, Accept: "image/*" } }),
        makeEnv(assets),
      );
      expect(image.status).toBe(200);
      expect(image.headers.get("Content-Type")).toBe("image/png");
    },
  );

  it("serves the marketing .html files as they are", async () => {
    const response = await serve(
      new Request(`${ORIGIN}/home.html`, { headers: { "User-Agent": "Mozilla/5.0" } }),
      makeEnv(echoAssets()),
    );
    expect(response.status).toBe(200);
  });
});
