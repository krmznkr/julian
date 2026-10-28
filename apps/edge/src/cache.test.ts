// @vitest-environment node
import { SECURITY_HEADERS } from "@julian/security";
import { describe, expect, it, vi } from "vitest";
import { IMMUTABLE_CACHE_CONTROL } from "./cache";
import type { Env } from "./env";
import { serve } from "./pipeline";

const ORIGIN = "https://julian.krmznkr.com";

// What the assets binding sends for every file today.
const REVALIDATE = "public, max-age=0, must-revalidate";

const allow = { limit: async () => ({ success: true }) };

const makeEnv = (assets: Env["ASSETS"]["fetch"]): Env => ({
  ASSETS: { fetch: assets },
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
  SITE_RATELIMIT: allow,
  OAUTH_RATELIMIT: allow,
});

// An assets binding that answers every path with one canned response.
const answer = (
  status: number,
  contentType: string | null,
  extra: Record<string, string> = {},
  body: string | null = status === 200 ? "body" : null,
) =>
  vi.fn<Env["ASSETS"]["fetch"]>(
    async () =>
      new Response(body, {
        status,
        headers: {
          ...(contentType === null ? {} : { "Content-Type": contentType }),
          "Cache-Control": REVALIDATE,
          ETag: '"abc123"',
          ...extra,
        },
      }),
  );

const JS = "text/javascript; charset=utf-8";
const CSS = "text/css; charset=utf-8";

// A script or stylesheet fetch, as a browser sends it for `<script>`/`<link>`.
const subresource = (
  path: string,
  { method = "GET", headers = {} }: { method?: string; headers?: Record<string, string> } = {},
) =>
  new Request(`${ORIGIN}${path}`, {
    method,
    headers: { "User-Agent": "Mozilla/5.0", "Sec-Fetch-Mode": "no-cors", ...headers },
  });

const cacheControl = async (request: Request, assets: Env["ASSETS"]["fetch"]) =>
  (await serve(request, makeEnv(assets))).headers.get("Cache-Control");

describe("hashed asset caching", () => {
  // Real names from the 0.4.2 build: the hash may hold `_` and `-`, and the
  // name may itself contain hyphens.
  it.each([
    ["/assets/index-ofsL1HhE.js", JS],
    ["/assets/icons-j_B15rUX.js", JS],
    ["/assets/rolldown-runtime-WkwZ5CU-.js", JS],
    ["/assets/year-page-k9wdf0HI.js", "application/javascript"],
    ["/assets/index-BJFr9l2M.css", CSS],
    ["/_marketing/observability-By3t3rX2.js", JS],
    ["/_marketing/observability-DN_rWpjU.css", CSS],
  ])("caches %s for a year as immutable", async (path, type) => {
    const response = await serve(subresource(path), makeEnv(answer(200, type)));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe(IMMUTABLE_CACHE_CONTROL);
    expect(response.headers.get("Content-Type")).toBe(type);
    expect(response.headers.get("ETag")).toBe('"abc123"');
    expect(await response.text()).toBe("body");
  });

  it("keeps every security header on a cached asset", async () => {
    const response = await serve(
      subresource("/assets/index-ofsL1HhE.js"),
      makeEnv(answer(200, JS)),
    );
    expect(response.headers.get("Cache-Control")).toBe(IMMUTABLE_CACHE_CONTROL);
    Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
      expect(response.headers.get(key)).toBe(value);
    });
  });

  it("marks a 304 for a hashed asset immutable, so a revalidated copy stops asking", async () => {
    const response = await serve(
      subresource("/assets/react-DTcjPVoX.js", { headers: { "If-None-Match": '"abc123"' } }),
      makeEnv(answer(304, JS)),
    );
    expect(response.status).toBe(304);
    expect(response.headers.get("Cache-Control")).toBe(IMMUTABLE_CACHE_CONTROL);
    expect(response.body).toBeNull();
  });

  it("sets the header when the assets binding sent no Cache-Control", async () => {
    const assets = vi.fn<Env["ASSETS"]["fetch"]>(
      async () => new Response("body", { headers: { "Content-Type": JS } }),
    );
    expect(await cacheControl(subresource("/assets/index-ofsL1HhE.js"), assets)).toBe(
      IMMUTABLE_CACHE_CONTROL,
    );
  });

  it("caches a HEAD request for a hashed asset", async () => {
    const assets = answer(200, JS, {}, null);
    const response = await serve(
      subresource("/assets/index-ofsL1HhE.js", { method: "HEAD" }),
      makeEnv(assets),
    );
    expect(response.headers.get("Cache-Control")).toBe(IMMUTABLE_CACHE_CONTROL);
    expect(assets.mock.calls[0]?.[0].method).toBe("HEAD");
  });

  it("caches a direct navigation to a real hashed script", async () => {
    const request = new Request(`${ORIGIN}/assets/index-ofsL1HhE.js`, {
      headers: { "User-Agent": "Mozilla/5.0", "Sec-Fetch-Mode": "navigate" },
    });
    expect(await cacheControl(request, answer(200, JS))).toBe(IMMUTABLE_CACHE_CONTROL);
  });

  it.each([
    ["/bootstrap.js", "unhashed bootstrap script"],
    ["/assets/app.js", "no hash"],
    ["/assets/index-ofsL1Hh.js", "7-character hash"],
    ["/assets/index-ofsL1HhEx.js", "9-character hash"],
    ["/assets/index-ofs.L1HhE.js", "dot inside the hash"],
    ["/assets/indexofsL1HhE.js", "no separator before the hash"],
    ["/assets/nested/index-ofsL1HhE.js", "nested directory"],
    ["/assets/index-ofsL1HhE.js.map", "source map"],
    ["/assets/index-ofsL1HhE.mjs", "other extension"],
    ["/assets/index-ofsL1HhE.JS", "upper-case extension"],
    ["/assets/index-ofsL1%48hE.js", "percent-encoded name"],
    ["/ASSETS/index-ofsL1HhE.js", "other directory casing"],
    ["/static/index-ofsL1HhE.js", "other directory"],
    ["/demo/index-ofsL1HhE.js", "file-like demo path"],
    ["/index-ofsL1HhE.js", "site root"],
  ])("leaves %s (%s) to revalidate", async (path) => {
    expect(await cacheControl(subresource(path), answer(200, JS))).toBe(REVALIDATE);
  });

  it.each(["?v=1", "?month=10&day=27"])(
    "leaves a hashed asset with the query %s to revalidate",
    async (search) => {
      const assets = answer(200, JS);
      expect(await cacheControl(subresource(`/assets/index-ofsL1HhE.js${search}`), assets)).toBe(
        REVALIDATE,
      );
    },
  );

  it.each(["POST", "PUT", "DELETE", "OPTIONS"])(
    "leaves a %s to a hashed asset path untouched",
    async (method) => {
      const response = await serve(
        subresource("/assets/index-ofsL1HhE.js", { method }),
        makeEnv(answer(200, JS)),
      );
      expect(response.headers.get("Cache-Control")).toBe(REVALIDATE);
    },
  );

  it.each([
    [206, "a partial range"],
    [301, "a redirect"],
    [307, "a temporary redirect"],
    [403, "a refusal"],
    [404, "a miss"],
    [500, "a server error"],
    [503, "an outage"],
  ])("does not cache a %i (%s) for a hashed asset path", async (status) => {
    const response = await serve(
      subresource("/assets/index-ofsL1HhE.js"),
      makeEnv(answer(status, JS, status >= 300 && status < 400 ? { Location: "/x" } : {})),
    );
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe(REVALIDATE);
  });

  it.each<[number, string | null, string]>([
    [200, "text/html; charset=utf-8", "the HTML shell a navigation gets for a miss"],
    [304, "text/html; charset=utf-8", "a 304 for that shell"],
    [200, "text/plain", "plain text"],
    [200, "application/json", "JSON"],
    [200, null, "no Content-Type"],
    [304, null, "a 304 without Content-Type"],
  ])("does not cache a %i with %s (%s) at a hash-like path", async (status, type) => {
    const request = new Request(`${ORIGIN}/assets/missing-ABCDEFGH.js`, {
      headers: { "User-Agent": "Mozilla/5.0", "Sec-Fetch-Mode": "navigate", Accept: "text/html" },
    });
    expect(await cacheControl(request, answer(status, type))).toBe(REVALIDATE);
  });

  it("keeps the no-store 404 for a script request to a missing hash-like file", async () => {
    const response = await serve(
      subresource("/assets/missing-ABCDEFGH.js"),
      makeEnv(answer(200, "text/html; charset=utf-8")),
    );
    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it.each([
    [{ "Cache-Control": "private, max-age=0" }, "private, max-age=0"],
    [{ "Cache-Control": "no-store" }, "no-store"],
    [{ "Cache-Control": "public, NO-STORE" }, "public, NO-STORE"],
  ])("keeps a per-visitor Cache-Control %j", async (extra, expected) => {
    expect(
      await cacheControl(subresource("/assets/index-ofsL1HhE.js"), answer(200, JS, extra)),
    ).toBe(expected);
  });

  it("does not cache a hashed asset response that sets a cookie", async () => {
    const response = await serve(
      subresource("/assets/index-ofsL1HhE.js"),
      makeEnv(answer(200, JS, { "Set-Cookie": "a=1" })),
    );
    expect(response.headers.get("Cache-Control")).toBe(REVALIDATE);
  });

  it.each([
    ["/demo", "the demo page"],
    ["/demo/2026", "a deep demo link"],
    ["/2026", "the year view"],
    ["/privacy", "a marketing page"],
    ["/og-image.png", "the share image"],
  ])("leaves %s (%s) to revalidate", async (path) => {
    const request = new Request(`${ORIGIN}${path}`, {
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html" },
    });
    expect(await cacheControl(request, answer(200, "text/html; charset=utf-8"))).toBe(REVALIDATE);
  });

  it("keeps / private and uncached", async () => {
    const request = new Request(`${ORIGIN}/`, { headers: { "User-Agent": "Mozilla/5.0" } });
    expect(await cacheControl(request, answer(200, "text/html"))).toBe("private, no-store");
  });

  it("keeps /version.json uncached", async () => {
    const assets = answer(200, JS);
    expect(await cacheControl(subresource("/version.json"), assets)).toBe("no-store");
    expect(assets).not.toHaveBeenCalled();
  });

  it("keeps the OAuth proxy uncached", async () => {
    const assets = answer(200, JS);
    expect(await cacheControl(subresource("/api/oauth/token"), assets)).toBe("no-store");
    expect(assets).not.toHaveBeenCalled();
  });

  it("does not cache a blocked client's request for a hashed asset", async () => {
    const assets = answer(200, JS);
    const response = await serve(
      new Request(`${ORIGIN}/assets/index-ofsL1HhE.js`, { headers: { "User-Agent": "curl/8.0" } }),
      makeEnv(assets),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBeNull();
    expect(assets).not.toHaveBeenCalled();
  });

  it("does not cache a rate-limited request for a hashed asset", async () => {
    const response = await serve(subresource("/assets/index-ofsL1HhE.js"), {
      ...makeEnv(answer(200, JS)),
      SITE_RATELIMIT: { limit: async () => ({ success: false }) },
    });
    expect(response.status).toBe(429);
    expect(response.headers.get("Cache-Control")).toBeNull();
  });
});
