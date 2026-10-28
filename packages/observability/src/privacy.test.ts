import { describe, expect, it } from "vitest";
import type { Event } from "@sentry/browser";
import type { SpanJSON, StreamedSpanJSON } from "./privacy";
import {
  POSTHOG_KEY,
  pagePath,
  sanitizePostHogEvent,
  sanitizeSentryEvent,
  sanitizeSpan,
  sanitizeStreamedSpan,
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
  status: "ok",
  description: secret,
  data: { "http.url": url, "url.query": secret, body: secret },
};
const segmentId = "d".repeat(16);
// A child span as Sentry 11 streams it, with the attributes the SDK and its
// integrations add: user, segment name, URL, DOM selector and status message.
const streamedSpan: StreamedSpanJSON = {
  trace_id: traceId,
  span_id: spanId,
  parent_span_id: segmentId,
  name: secret,
  start_timestamp: 10,
  end_timestamp: 20,
  status: "error",
  is_segment: false,
  attributes: {
    "sentry.op": "ui.interaction.click",
    "sentry.origin": "auto.http.browser.inp",
    "sentry.segment.id": segmentId,
    "sentry.segment.name": secret,
    "sentry.status.message": secret,
    "sentry.release": secret,
    "sentry.environment": secret,
    "user.email": secret,
    "user.ip_address": "203.0.113.7",
    "user_agent.original": "Mozilla/5.0 private",
    "url.full": url,
    "url.path": `/${secret}`,
    "http.url": url,
    "browser.web_vital.inp.target": `body > button[aria-label="${secret}"]`,
    "browser.web_vital.inp.value": 120,
    calendar: [secret],
    nested: { value: secret, unit: "none" },
  },
  links: [{ trace_id: traceId, span_id: spanId, attributes: { "sentry.link.type": secret } }],
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
    expect(clean.status).toBe("internal_error");
    expect(sanitizeSpan({ ...span, status: "deadline_exceeded" }).status).toBe("deadline_exceeded");
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
      op: "app",
      description: "Application performance",
      data: {},
    });
    expect(sanitizeSpan({ ...span, is_segment: true, description: url }).description).toBe(
      "/calendar",
    );
  });

  it("rebuilds streamed child spans from fixed values, the release and generated IDs", () => {
    const clean = sanitizeStreamedSpan(streamedSpan, "release-sha");
    expect(JSON.stringify(clean)).not.toContain(secret);
    expect(JSON.stringify(clean)).not.toContain("203.0.113.7");
    expect(JSON.stringify(clean)).not.toContain("Mozilla");
    expect(clean).toEqual({
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: segmentId,
      name: "Application performance",
      start_timestamp: 10,
      end_timestamp: 20,
      status: "error",
      is_segment: false,
      attributes: {
        "sentry.op": "app",
        "sentry.release": "release-sha",
        "sentry.environment": "production",
        "sentry.segment.id": segmentId,
      },
    });
    expect(
      sanitizeStreamedSpan({ ...streamedSpan, status: "ok", is_segment: false }, "sha").status,
    ).toBe("ok");
  });

  it.each([
    [{ "url.full": url, "url.path": `/${secret}` }, "Pageload", "/calendar"],
    [{ "url.path": "/demo/2026/03" }, "Navigation", "/demo"],
    [{ "url.full": `https://elsewhere.example/2026?token=${secret}` }, "Pageload", "/other"],
    [{ "url.full": { value: url } }, `/privacy?email=${secret}`, "/privacy"],
    [{}, secret, "/other"],
    [{}, `/auth/callback?code=${secret}#access_token=${secret}`, "/auth/callback"],
  ])("reduces a streamed root span to a route category: %j %s", (attributes, name, expected) => {
    const clean = sanitizeStreamedSpan(
      { ...streamedSpan, name, is_segment: true, parent_span_id: undefined, attributes },
      "release-sha",
    );
    expect(clean.name).toBe(expected);
    expect(clean.is_segment).toBe(true);
    expect(clean.attributes).toEqual({
      "sentry.op": "app",
      "sentry.release": "release-sha",
      "sentry.environment": "production",
      "sentry.segment.name": expected,
      "sentry.segment.name.source": "route",
    });
    expect(JSON.stringify(clean)).not.toContain(secret);
  });

  it("never throws on malformed streamed spans, so Sentry cannot send them unmodified", () => {
    const { attributes: _attributes, ...withoutAttributes } = streamedSpan;
    const clean = sanitizeStreamedSpan(
      {
        ...withoutAttributes,
        trace_id: secret,
        span_id: secret,
        parent_span_id: secret,
      } as StreamedSpanJSON,
      "sha",
    );
    expect(clean).toMatchObject({
      trace_id: "0".repeat(32),
      span_id: "0".repeat(16),
      parent_span_id: undefined,
      name: "Application performance",
      attributes: { "sentry.op": "app", "sentry.release": "sha" },
    });
    expect(clean.attributes).not.toHaveProperty("sentry.segment.id");
    expect(JSON.stringify(clean)).not.toContain(secret);
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
