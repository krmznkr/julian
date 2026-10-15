// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { Env } from "./env";
import { serve } from "./pipeline";

const allow = { limit: async () => ({ success: true }) };
const deny = { limit: async () => ({ success: false }) };

const makeEnv = (overrides: Partial<Env> = {}): Env => ({
  ASSETS: { fetch: async () => new Response("app", { headers: { "Content-Type": "text/html" } }) },
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
  SITE_RATELIMIT: allow,
  OAUTH_RATELIMIT: allow,
  ...overrides,
});

const BROWSER = "Mozilla/5.0";

const OAUTH_HEADERS = {
  Origin: "https://julian.krmznkr.com",
  "User-Agent": BROWSER,
  "Content-Type": "application/json",
};

const oauthRequest = (path: string, body: string, headers: Record<string, string> = {}) =>
  new Request(`https://julian.krmznkr.com${path}`, {
    method: "POST",
    headers: { ...OAUTH_HEADERS, ...headers },
    body,
  });

const refresh = (body: string, headers?: Record<string, string>) =>
  oauthRequest("/api/oauth/refresh", body, headers);

const pageRequest = (userAgent?: string) =>
  new Request("https://julian.krmznkr.com/", {
    headers: userAgent === undefined ? {} : { "User-Agent": userAgent },
  });

const neverFetch = () => vi.fn<typeof globalThis.fetch>();

describe("version endpoint", () => {
  const versionRequest = () =>
    new Request("https://julian.krmznkr.com/version.json", { headers: { "User-Agent": BROWSER } });

  it("reports the deployed build without touching assets", async () => {
    const assets = vi.fn<Env["ASSETS"]["fetch"]>();
    const env = makeEnv({
      ASSETS: { fetch: assets },
      APP_VERSION: "1.4.0",
      APP_CHANNEL: "stable",
      APP_COMMIT: "abc1234",
    });
    const response = await serve(versionRequest(), env);
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Content-Security-Policy")).not.toBeNull();
    expect(await response.json()).toEqual({
      version: "1.4.0",
      channel: "stable",
      commit: "abc1234",
    });
    expect(assets).not.toHaveBeenCalled();
  });

  it("falls back when the deploy set no build vars", async () => {
    const response = await serve(versionRequest(), makeEnv());
    expect(await response.json()).toEqual({
      version: "unknown",
      channel: "dev",
      commit: "unknown",
    });
  });
});

describe("site guards", () => {
  it("serves assets to browsers with the security headers", async () => {
    const response = await serve(pageRequest(BROWSER), makeEnv());
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("app");
    expect(response.headers.get("Content-Type")).toBe("text/html");
    expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  it.each(["", "curl/8.0", "python-requests/2.31", "Mozilla/5.0 (compatible; AhrefsBot/7.0)"])(
    "blocks scripted or scraper clients: %j",
    async (ua) => {
      const response = await serve(pageRequest(ua), makeEnv());
      expect(response.status).toBe(403);
      expect(response.headers.get("Content-Security-Policy")).not.toBeNull();
    },
  );

  it("rate limits the whole site per client", async () => {
    const response = await serve(pageRequest(BROWSER), makeEnv({ SITE_RATELIMIT: deny }));
    expect(response.status).toBe(429);
  });
});

describe("OAuth proxy", () => {
  it("rejects other methods", async () => {
    const request = new Request("https://julian.krmznkr.com/api/oauth/refresh", {
      headers: OAUTH_HEADERS,
    });
    const response = await serve(request, makeEnv());
    expect(response.status).toBe(405);
  });

  it.each<Record<string, string>>([{}, { Origin: "https://evil.example" }])(
    "rejects foreign or missing origins: %j",
    async (headers) => {
      const request = new Request("https://julian.krmznkr.com/api/oauth/refresh", {
        method: "POST",
        headers: { "User-Agent": BROWSER, ...headers },
        body: '{"refresh_token":"refresh"}',
      });
      const response = await serve(request, makeEnv());
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: "forbidden",
        error_description: "Origin not allowed",
      });
    },
  );

  it("rejects an oversized declared Content-Length before reading", async () => {
    const response = await serve(refresh("{}", { "Content-Length": "100000" }), makeEnv());
    expect(response.status).toBe(413);
  });

  it("caps the actual body when Content-Length is missing", async () => {
    const fetch = neverFetch();
    const response = await serve(
      refresh(JSON.stringify({ refresh_token: "x".repeat(4096) })),
      makeEnv(),
      fetch,
    );
    expect(response.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("applies the tighter OAuth rate limit", async () => {
    const response = await serve(
      refresh('{"refresh_token":"refresh"}'),
      makeEnv({ OAUTH_RATELIMIT: deny }),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ error: "rate_limited" });
  });

  it("reports a missing client secret as a server misconfiguration", async () => {
    const response = await serve(
      refresh('{"refresh_token":"refresh"}'),
      makeEnv({ GOOGLE_CLIENT_SECRET: "" }),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({ error: "server_misconfigured" });
  });

  it("returns 404 for unknown OAuth paths", async () => {
    const response = await serve(oauthRequest("/api/oauth/other", "{}"), makeEnv());
    expect(response.status).toBe(404);
  });

  it.each(["null", "[]", "not json", '{"refresh_token":123}', '{"refresh_token":""}'])(
    "rejects malformed credentials: %s",
    async (body) => {
      const fetch = neverFetch();
      const response = await serve(refresh(body), makeEnv(), fetch);
      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("requires every PKCE field for the code exchange", async () => {
    const response = await serve(
      oauthRequest("/api/oauth/token", '{"code":"c","code_verifier":"v"}'),
      makeEnv(),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error_description: "Missing code/code_verifier/redirect_uri",
    });
  });

  it("reports an upstream connection failure as 502, not bad user input", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError("network down"));
    const response = await serve(refresh('{"refresh_token":"refresh"}'), makeEnv(), fetch);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "upstream_unavailable" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("exchanges a refresh token with the server-held secret and prevents caching", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response('{"access_token":"access"}', { status: 200 }));
    const response = await serve(refresh('{"refresh_token":"refresh"}'), makeEnv(), fetch);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ access_token: "access" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://oauth2.googleapis.com/token");
    expect(init?.method).toBe("POST");
    const sent = new URLSearchParams(await new Response(init?.body).text());
    expect(Object.fromEntries(sent)).toEqual({
      client_id: "test-client",
      client_secret: "test-secret",
      refresh_token: "refresh",
      grant_type: "refresh_token",
    });
  });

  it("exchanges an authorization code and passes Google's status through", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response('{"error":"invalid_grant"}', { status: 400 }));
    const response = await serve(
      oauthRequest(
        "/api/oauth/token",
        '{"code":"c","code_verifier":"v","redirect_uri":"https://julian.krmznkr.com/auth/callback"}',
      ),
      makeEnv(),
      fetch,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_grant" });
    const sent = new URLSearchParams(await new Response(fetch.mock.calls[0]?.[1]?.body).text());
    expect(sent.get("grant_type")).toBe("authorization_code");
    expect(sent.get("code_verifier")).toBe("v");
  });
});
