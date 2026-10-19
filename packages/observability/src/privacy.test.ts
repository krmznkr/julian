import { describe, expect, it } from "vitest";
import type { Event } from "@sentry/browser";
import type { SpanJSON } from "./privacy";
import {
  POSTHOG_KEY,
  pagePath,
  sanitizePostHogEvent,
  sanitizeSentryEvent,
  sanitizeSpan,
} from "./privacy";

const secret = "private-calendar-title-alice@example.com-ya29.oauth-token";
const url = `https://julian.krmznkr.com/2026?code=${secret}#access_token=${secret}`;
const traceId = "a".repeat(32);
const spanId = "b".repeat(16);
const span: SpanJSON = {
  trace_id: traceId,
  span_id: spanId,
  start_timestamp: 10,
  timestamp: 20,
  op: "http.client",
  description: secret,
  data: { "http.url": url, "url.query": secret, body: secret },
};

describe("telemetry privacy boundary", () => {
  it.each([
    [url, "/calendar"],
    ["/demo/2026/03?title=private#token", "/demo"],
    ["/demo", "/demo"],
    ["/year/2026", "/calendar"],
    ["/", "/"],
    ["/privacy?email=private", "/privacy"],
    ["/terms", "/terms"],
    ["/auth/callback?code=private", "/auth/callback"],
    [`/${secret}`, "/other"],
    [`https://${secret}`, "/other"],
    ["https://elsewhere.example/2026", "/other"],
    [null, "/other"],
  ])("reduces %s to a static page category", (value, expected) => {
    expect(pagePath(value)).toBe(expected);
  });

  it("discards every free-text span field, including unknown future fields", () => {
    const clean = sanitizeSpan({ ...span, status: secret, unknown: secret } as SpanJSON);
    expect(JSON.stringify(clean)).not.toContain(secret);
    expect(
      sanitizeSpan({ ...span, trace_id: secret, span_id: secret, parent_span_id: secret }),
    ).toMatchObject({
      trace_id: "0".repeat(32),
      span_id: "0".repeat(16),
      parent_span_id: undefined,
    });
    expect(sanitizeSpan({ ...span, parent_span_id: spanId }).parent_span_id).toBe(spanId);
    expect(clean).toMatchObject({
      trace_id: traceId,
      span_id: spanId,
      start_timestamp: 10,
      timestamp: 20,
      data: {},
    });
  });

  it("removes personal data from errors, causes, request, contexts, stack and debug metadata", () => {
    const input: Event = {
      event_id: "c".repeat(32),
      timestamp: 20,
      message: secret,
      user: { email: secret },
      extra: { calendars: [secret] },
      tags: { title: secret },
      breadcrumbs: [{ message: secret, data: { url } }],
      request: {
        url,
        headers: { Authorization: secret },
        cookies: { session: secret },
        data: secret,
        query_string: secret,
      },
      contexts: {
        trace: { trace_id: traceId, span_id: spanId, op: secret, data: { title: secret } },
        personal: { title: secret },
      },
      exception: {
        values: [
          {
            type: secret,
            value: secret,
            stacktrace: {
              frames: [
                {
                  filename: `https://julian.krmznkr.com/assets/index-abc.js?token=${secret}#private`,
                  lineno: 3,
                  colno: 4,
                  function: secret,
                  vars: { title: secret },
                  context_line: secret,
                },
                { filename: `https://www.googleapis.com/calendar/${secret}` },
                { filename: "http://[" },
                {},
              ],
            },
          },
          { type: "TypeError", value: secret },
        ],
      },
      debug_meta: {
        images: [
          {
            type: "sourcemap",
            code_file: `https://julian.krmznkr.com/assets/index-abc.js?${secret}`,
            debug_id: "12345678-1234-1234-1234-123456789abc",
          },
          { type: "sourcemap", code_file: secret, debug_id: secret },
        ],
      },
    };
    const clean = sanitizeSentryEvent(input, "release-sha");
    expect(JSON.stringify(clean)).not.toContain(secret);
    expect(clean.request).toEqual({ url: "https://julian.krmznkr.com/calendar" });
    expect(clean.exception?.values?.[0]?.stacktrace?.frames).toEqual([
      {
        filename: "https://julian.krmznkr.com/assets/index-abc.js",
        lineno: 3,
        colno: 4,
        in_app: true,
      },
    ]);
    expect(clean.exception?.values?.[1]?.type).toBe("TypeError");
    expect(clean.release).toBe("release-sha");
    expect(clean.debug_meta?.images).toHaveLength(1);
    expect(input.message).toBe(secret);
  });

  it("scrubs transactions and handles empty SDK fields", () => {
    const clean = sanitizeSentryEvent(
      { type: "transaction", transaction: url, spans: [span], exception: {}, debug_meta: {} },
      "sha",
    );
    expect(clean.transaction).toBe("/calendar");
    expect(JSON.stringify(clean)).not.toContain(secret);
    expect(sanitizeSentryEvent({}, "sha")).toMatchObject({
      release: "sha",
      tags: { app: "julian" },
    });
  });

  it("allows only pageview/pageleave properties and drops custom/identity events", () => {
    for (const event of ["$pageview", "$pageleave"]) {
      const clean = sanitizePostHogEvent({
        event,
        uuid: "12345678-1234-1234-1234-123456789abc",
        properties: {
          distinct_id: "12345678-1234-1234-1234-123456789abc",
          $current_url: url,
          $referrer: url,
          $title: secret,
          email: secret,
          $set: { calendars: secret },
          future: { secret },
        },
      });
      expect(JSON.stringify(clean)).not.toContain(secret);
      expect(clean?.properties).toEqual({
        distinct_id: "12345678-1234-1234-1234-123456789abc",
        token: POSTHOG_KEY,
        $current_url: "https://julian.krmznkr.com/calendar",
        $pathname: "/calendar",
        $process_person_profile: false,
        $geoip_disable: true,
        $ip: null,
        app: "julian",
        environment: "production",
      });
    }
    expect(
      sanitizePostHogEvent({
        event: "$identify",
        uuid: "12345678-1234-1234-1234-123456789abc",
        properties: { email: secret },
      }),
    ).toBeNull();
    expect(sanitizePostHogEvent(null)).toBeNull();
    expect(
      sanitizePostHogEvent({
        event: "$pageview",
        uuid: secret,
        properties: { distinct_id: secret },
      }),
    ).toBeNull();
    expect(
      sanitizePostHogEvent({
        event: "$pageview",
        uuid: "12345678-1234-1234-1234-123456789abc",
        properties: { distinct_id: secret },
      }),
    ).toBeNull();
    expect(
      sanitizePostHogEvent({
        event: "$pageview",
        uuid: "12345678-1234-1234-1234-123456789abc",
        properties: {},
      }),
    ).toBeNull();
  });
});
