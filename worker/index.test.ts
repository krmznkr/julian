// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";

const env = {
  ASSETS: { fetch: async () => new Response("app") },
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
  SITE_RATELIMIT: { limit: async () => ({ success: true }) },
  OAUTH_RATELIMIT: { limit: async () => ({ success: true }) },
};
const request = (body: string) =>
  new Request("https://julian.krmznkr.com/api/oauth/refresh", {
    method: "POST",
    headers: {
      Origin: "https://julian.krmznkr.com",
      "User-Agent": "Mozilla/5.0",
      "Content-Type": "application/json",
    },
    body,
  });

afterEach(() => vi.unstubAllGlobals());

describe("OAuth proxy", () => {
  it("caps the actual body when Content-Length is missing", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    vi.stubGlobal("fetch", fetch);
    const response = await worker.fetch(
      request(JSON.stringify({ refresh_token: "x".repeat(4096) })),
      env,
    );
    expect(response.status).toBe(413);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(["null", "[]", "not json", '{"refresh_token":123}', '{"refresh_token":{}}'])(
    "rejects malformed credentials: %s",
    async (body) => {
      const fetch = vi.fn<typeof globalThis.fetch>();
      vi.stubGlobal("fetch", fetch);
      const response = await worker.fetch(request(body), env);
      expect(response.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it("reports an upstream connection failure as 502, not bad user input", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError("network down")),
    );
    const response = await worker.fetch(request('{"refresh_token":"refresh"}'), env);
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "upstream_unavailable" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("exchanges valid credentials and prevents caching of tokens", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response('{"access_token":"access"}', { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    const response = await worker.fetch(request('{"refresh_token":"refresh"}'), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ access_token: "access" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(fetch).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
