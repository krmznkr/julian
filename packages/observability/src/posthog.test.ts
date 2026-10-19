// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://julian.krmznkr.com/2026?code=private#oauth=private"}
import { afterEach, describe, expect, it, vi } from "vitest";
import { POSTHOG_KEY } from "./privacy";

vi.mock("@sentry/browser", () => ({
  init: () => undefined,
  globalHandlersIntegration: () => ({}),
  browserApiErrorsIntegration: () => ({}),
  browserTracingIntegration: () => ({}),
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PostHog SDK capture boundary", () => {
  it("ingests the public project key while removing content, OAuth data and persistent identity", async () => {
    const requests: { url: string; body: unknown }[] = [];
    vi.stubGlobal("fetch", async (url: string, options?: RequestInit) => {
      requests.push({ url: String(url), body: options?.body });
      return new Response('{"status":1}', { status: 200 });
    });
    const secret = "Dentist-appointment-alice@example.com-ya29.private-token";
    document.title = secret;
    localStorage.setItem("julian_test_oauth_token", secret);
    const { default: posthog } = await import("posthog-js/dist/module.slim");
    const { initialize } = await import("./browser");
    initialize("sha");
    // Make the request inspectable; collection/privacy settings stay intact.
    posthog.set_config({ disable_compression: true, request_batching: false });
    const captured = posthog.capture(
      "$pageview",
      {
        $current_url: `https://julian.krmznkr.com/2026?code=${secret}#token=${secret}`,
        $title: secret,
        calendar: { title: secret },
        email: secret,
        $set: { name: secret },
      },
      { send_instantly: true, transport: "fetch" },
    );
    expect(captured?.properties).toMatchObject({
      token: POSTHOG_KEY,
      app: "julian",
      environment: "production",
      $current_url: "https://julian.krmznkr.com/calendar",
      $pathname: "/calendar",
    });
    expect(captured?.properties.distinct_id).toMatch(/^[a-f0-9-]{36}$/i);
    expect(JSON.stringify(captured)).not.toContain(secret);
    await vi.waitFor(() => {
      expect(requests.length).toBeGreaterThan(0);
    });
    expect(JSON.stringify(requests)).not.toContain(secret);
    expect(requests.every((request) => request.url.startsWith("https://eu.i.posthog.com/"))).toBe(
      true,
    );
    expect(document.cookie).toBe("");
    expect(Object.keys(localStorage)).toEqual(["julian_test_oauth_token"]);
    posthog.opt_out_capturing();
    localStorage.clear();
  });
});
