import { describe, expect, it } from "vitest";
import * as Sentry from "@sentry/browser";
import { sentryOptions } from "./browser";
import { sanitizeSentryEvent, sanitizeSpan } from "./privacy";

// Exercise the real SDK's envelope builder after beforeSend, including metadata
// added by the SDK. No request leaves the process. The first two tests cover
// transaction events and their SpanJSON children (`traceLifecycle: "static"`);
// the last runs the production options, which stream spans instead.
describe("Sentry wire payload", () => {
  it("retains usable error locations and timing without personal envelope metadata", async () => {
    const envelopes: unknown[] = [];
    const secret = "Dentist appointment alice@example.com ya29.oauth-secret";
    Sentry.init({
      dsn: "https://ac6d42a09e387ccbd1f541b47fa460fe@o4511769287000064.ingest.de.sentry.io/4511769300762704",
      defaultIntegrations: false,
      sendClientReports: false,
      tracesSampleRate: 0.05,
      traceLifecycle: "static",
      beforeSend: (event) => sanitizeSentryEvent(event, "release-sha"),
      beforeSendTransaction: (event) => sanitizeSentryEvent(event, "release-sha"),
      beforeSendSpan: Sentry.withStaticSpan(sanitizeSpan),
      transport: () => ({
        send: (envelope) => {
          envelopes.push(envelope);
          return Promise.resolve({ statusCode: 200 });
        },
        flush: () => Promise.resolve(true),
      }),
    });
    Sentry.withScope((scope) => {
      scope.setUser({ email: secret });
      scope.setExtra("calendar", { title: secret });
      scope.addBreadcrumb({ message: secret });
      Sentry.captureEvent({
        exception: {
          values: [
            {
              type: "TypeError",
              value: secret,
              stacktrace: {
                frames: [
                  {
                    filename: `https://julian.krmznkr.com/assets/index-abc.js?token=${secret}`,
                    lineno: 5,
                    colno: 9,
                    function: secret,
                  },
                ],
              },
            },
          ],
        },
        request: {
          url: `https://julian.krmznkr.com/auth/callback?code=${secret}`,
          headers: { Authorization: secret },
          data: secret,
        },
        sdkProcessingMetadata: {
          dynamicSamplingContext: { transaction: secret, environment: secret },
        },
      });
      Sentry.captureEvent({
        type: "transaction",
        transaction: `/2026?title=${secret}`,
        start_timestamp: 1,
        timestamp: 2,
        contexts: { trace: { trace_id: "a".repeat(32), span_id: "b".repeat(16) } },
        spans: [
          {
            trace_id: "a".repeat(32),
            span_id: "c".repeat(16),
            start_timestamp: 1,
            timestamp: 2,
            status: secret,
            description: secret,
            data: { "http.url": secret },
          },
        ],
        sdkProcessingMetadata: { dynamicSamplingContext: { transaction: secret } },
      });
    });
    await Sentry.flush(2000);
    expect(envelopes).toHaveLength(2);
    const payload = JSON.stringify(envelopes);
    expect(payload).not.toContain(secret);
    expect(payload).toContain("release-sha");
    expect(payload).toContain("index-abc.js");
    expect(payload).toContain("Unhandled application error");
    expect(payload).toContain("/calendar");
    await Sentry.close();
  });

  it("keeps distinct static root routes through the real SDK while scrubbing child spans and malicious names", async () => {
    const envelopes: unknown[] = [];
    const transactions: Sentry.Event[] = [];
    const secret = "Dentist-appointment-alice@example.com-ya29.oauth-secret";
    const routes = [
      [`/2026?month=10&title=${secret}#access_token=${secret}`, "/calendar"],
      [`/demo/2026/03?search=${secret}#${secret}`, "/demo"],
      [`https://julian.krmznkr.com/privacy?email=${secret}#${secret}`, "/privacy"],
      [`/auth/callback?code=${secret}#access_token=${secret}`, "/auth/callback"],
      ["/", "/"],
      ["/home", "/home"],
      ["/terms", "/terms"],
      ["/calendar", "/calendar"],
      [secret, "/other"],
      [`/${secret}`, "/other"],
      [`/demo/${secret}`, "/other"],
      [`/auth/callback/${secret}`, "/other"],
      [`https://elsewhere.example/2026?token=${secret}`, "/other"],
      [`https://${secret}@elsewhere.example/privacy`, "/other"],
      ["/%61lice%40example.com", "/other"],
      ["http://[", "/other"],
    ] as const;
    Sentry.init({
      dsn: "https://ac6d42a09e387ccbd1f541b47fa460fe@o4511769287000064.ingest.de.sentry.io/4511769300762704",
      defaultIntegrations: false,
      sendClientReports: false,
      tracesSampleRate: 0.05,
      traceLifecycle: "static",
      beforeSendTransaction: (event) => sanitizeSentryEvent(event, "release-sha"),
      beforeSendSpan: Sentry.withStaticSpan(sanitizeSpan),
      transport: () => ({
        send: (envelope) => {
          envelopes.push(envelope);
          const item = envelope[1][0];
          if (item?.[0].type === "transaction") transactions.push(item[1] as Sentry.Event);
          return Promise.resolve({ statusCode: 200 });
        },
        flush: () => Promise.resolve(true),
      }),
    });
    try {
      routes.forEach(([route]) => {
        Sentry.captureEvent({
          type: "transaction",
          transaction: route,
          start_timestamp: 1,
          timestamp: 2,
          contexts: {
            trace: {
              trace_id: "a".repeat(32),
              span_id: "b".repeat(16),
              // A root transaction may have an upstream parent; use Sentry's
              // segment marker rather than guessing from parent_span_id.
              parent_span_id: "d".repeat(16),
              op: "navigation",
              data: { title: secret },
            },
          },
          spans: [
            {
              trace_id: "a".repeat(32),
              span_id: "c".repeat(16),
              parent_span_id: "b".repeat(16),
              start_timestamp: 1,
              timestamp: 2,
              op: "http.client",
              status: "ok",
              description: `/privacy?title=${secret}`,
              data: { "http.url": secret },
            },
            {
              trace_id: "a".repeat(32),
              span_id: "e".repeat(16),
              parent_span_id: "b".repeat(16),
              start_timestamp: 1,
              timestamp: 2,
              status: secret,
              description: secret,
              data: { title: secret },
            },
          ],
          request: { url: route, headers: { Authorization: secret }, data: secret },
          user: { email: secret },
          extra: { calendar: secret },
          sdkProcessingMetadata: { dynamicSamplingContext: { transaction: secret } },
        });
      });
      await Sentry.flush(2000);
      expect(transactions.map((event) => event.transaction)).toEqual(
        routes.map(([, expected]) => expected),
      );
      transactions.forEach((event) => {
        expect(event.contexts?.trace).toEqual({
          trace_id: "a".repeat(32),
          span_id: "b".repeat(16),
          op: "app",
        });
        expect(
          event.spans?.map((span) => ({
            description: span.description,
            op: span.op,
            status: span.status,
            data: span.data,
          })),
        ).toEqual([
          { description: "Application performance", op: "app", status: "ok", data: {} },
          {
            description: "Application performance",
            op: "app",
            status: "internal_error",
            data: {},
          },
        ]);
      });
      const payload = JSON.stringify(envelopes);
      expect(payload).not.toContain(secret);
      expect(payload).not.toContain("elsewhere.example");
      expect(payload).not.toContain("%61lice");
      expect(payload).not.toContain("http://[");
      expect(payload).not.toContain("access_token");
    } finally {
      await Sentry.close();
    }
  });
  it("streams only allowlisted spans and turns off IP and user agent inference with the production options", async () => {
    // Record envelopes as the JSON that goes over the wire.
    type Item = [{ type: string }, Record<string, unknown>];
    const envelopes: Array<[Record<string, unknown>, Item[]]> = [];
    const secret = "private-calendar-title-alice@example.com-ya29.oauth-token";
    Sentry.init({
      ...sentryOptions("release-sha"),
      transport: () => ({
        send: (envelope) => {
          envelopes.push(JSON.parse(JSON.stringify(envelope)));
          return Promise.resolve({ statusCode: 200 });
        },
        flush: () => Promise.resolve(true),
      }),
    });
    try {
      // The span container's infer_ip and infer_user_agent are "never" exactly
      // when userInfo is false (core tracing/spans/envelope.js). The SDK only
      // adds that container field in a real browser, so check its input here.
      expect(Sentry.getClient()?.getDataCollectionOptions()).toEqual({
        userInfo: false,
        cookies: false,
        httpHeaders: { request: false, response: false },
        httpBodies: [],
        urlQueryParams: false,
        graphQL: { document: false, variables: false },
        genAI: { inputs: false, outputs: false },
        mcp: { inputs: false, outputs: false },
        databaseQueryData: false,
        queues: false,
        stackFrameVariables: false,
        frameContextLines: 0,
      });
      Sentry.withScope((scope) => {
        scope.setUser({ email: secret, ip_address: "203.0.113.7", username: secret });
        scope.setAttributes({ calendar: secret });
        // Production samples 5% of traces. Pin this trace inside that 5%
        // instead of changing the production sample rate.
        scope.setPropagationContext({ traceId: "a".repeat(32), sampleRand: 0.01 });
        // The same shape browserTracingIntegration gives a streamed pageload.
        Sentry.startSpan(
          {
            name: "Pageload",
            op: "pageload",
            attributes: {
              "sentry.segment.name.source": "url",
              "url.full": `https://julian.krmznkr.com/2026?title=${secret}#access_token=${secret}`,
              "url.path": "/2026",
              title: secret,
            },
          },
          () => {
            Sentry.startSpan(
              {
                name: secret,
                op: "ui.interaction.click",
                attributes: {
                  "browser.web_vital.inp.target": `body > button[aria-label="${secret}"]`,
                  "http.url": `https://www.googleapis.com/calendar/v3/events?q=${secret}`,
                },
              },
              (span) => {
                span.setStatus({ code: 2, message: secret });
              },
            );
          },
        );
        Sentry.captureException(new Error(secret));
      });
      await Sentry.flush(2000);
      const payload = JSON.stringify(envelopes);
      expect(payload).not.toContain(secret);
      expect(payload).not.toContain("203.0.113.7");
      expect(payload).not.toContain("googleapis");
      expect(payload).not.toContain("aria-label");
      expect(payload).not.toContain('"auto"');

      const items = envelopes.flatMap(([, envelopeItems]) => envelopeItems);
      const spans = items.flatMap(([header, body]) =>
        header.type === "span" ? (body["items"] as StreamedSpanItem[]) : [],
      );
      expect(
        spans
          .map((span) => ({
            name: span.name,
            status: span.status,
            is_segment: span.is_segment,
            attributes: Object.keys(span.attributes).sort(),
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      ).toEqual([
        {
          name: "/calendar",
          status: "ok",
          is_segment: true,
          attributes: [
            "sentry.environment",
            "sentry.op",
            "sentry.release",
            "sentry.segment.id",
            "sentry.segment.name",
            "sentry.segment.name.source",
          ],
        },
        {
          name: "Application performance",
          status: "error",
          is_segment: false,
          attributes: ["sentry.environment", "sentry.op", "sentry.release", "sentry.segment.id"],
        },
      ]);
      spans.forEach((span) => {
        expect(span.attributes["sentry.release"]?.value).toBe("release-sha");
      });
      // The trace header bypasses beforeSendSpan. A URL-sourced root keeps the
      // route out of it.
      envelopes.forEach(([header]) => {
        expect(header["trace"] ?? {}).not.toHaveProperty("transaction");
      });

      const errors = items.flatMap(([header, body]) => (header.type === "event" ? [body] : []));
      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        sdk: { settings: { infer_ip: "never" } },
        exception: { values: [{ value: "Unhandled application error" }] },
      });
      expect(errors[0]).not.toHaveProperty("user");
    } finally {
      await Sentry.close();
    }
  });

  it("keeps a custom root span name out of the envelope trace header", async () => {
    // Sentry copies a root span's name into the trace header unless its source
    // is "url". beforeSendSpan cannot reach that header.
    const envelopes: Array<[Record<string, unknown>, unknown[]]> = [];
    const secret = "private-calendar-title-alice@example.com-ya29.oauth-token";
    Sentry.init({
      ...sentryOptions("release-sha"),
      transport: () => ({
        send: (envelope) => {
          envelopes.push(JSON.parse(JSON.stringify(envelope)));
          return Promise.resolve({ statusCode: 200 });
        },
        flush: () => Promise.resolve(true),
      }),
    });
    try {
      Sentry.withScope((scope) => {
        scope.setPropagationContext({ traceId: "b".repeat(32), sampleRand: 0.01 });
        Sentry.startSpan(
          { name: secret, attributes: { "sentry.segment.name.source": "custom" } },
          () => {
            Sentry.captureException(new Error(secret));
          },
        );
      });
      await Sentry.flush(2000);
      expect(envelopes.length).toBeGreaterThan(0);
      expect(JSON.stringify(envelopes)).not.toContain(secret);
      const traceHeaders = envelopes.flatMap(([header]) =>
        header["trace"] === undefined ? [] : [header["trace"]],
      );
      // The span envelope carries a trace header; the scrubbed error event has none.
      expect(traceHeaders).toHaveLength(1);
      expect(traceHeaders[0]).toMatchObject({ trace_id: "b".repeat(32), sampled: "true" });
      expect(traceHeaders[0]).not.toHaveProperty("transaction");
    } finally {
      await Sentry.close();
    }
  });
});

interface StreamedSpanItem {
  readonly name: string;
  readonly status: string;
  readonly is_segment: boolean;
  readonly attributes: Readonly<Record<string, { readonly value: unknown }>>;
}
