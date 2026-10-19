import { describe, expect, it } from "vitest";
import * as Sentry from "@sentry/browser";
import { sanitizeSentryEvent, sanitizeSpan } from "./privacy";

// Exercise the real SDK's envelope builder after beforeSend, including metadata
// added by the SDK. No request leaves the process.
describe("Sentry wire payload", () => {
  it("retains usable error locations and timing without personal envelope metadata", async () => {
    const envelopes: unknown[] = [];
    const secret = "Dentist appointment alice@example.com ya29.oauth-secret";
    Sentry.init({
      dsn: "https://ac6d42a09e387ccbd1f541b47fa460fe@o4511769287000064.ingest.de.sentry.io/4511769300762704",
      defaultIntegrations: false,
      sendClientReports: false,
      tracesSampleRate: 0.05,
      beforeSend: (event) => sanitizeSentryEvent(event, "release-sha"),
      beforeSendTransaction: (event) => sanitizeSentryEvent(event, "release-sha"),
      beforeSendSpan: sanitizeSpan,
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
      beforeSendTransaction: (event) => sanitizeSentryEvent(event, "release-sha"),
      beforeSendSpan: sanitizeSpan,
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
              description: `/privacy?title=${secret}`,
              data: { "http.url": secret },
            },
            {
              trace_id: "a".repeat(32),
              span_id: "e".repeat(16),
              parent_span_id: "b".repeat(16),
              start_timestamp: 1,
              timestamp: 2,
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
            data: span.data,
          })),
        ).toEqual([
          { description: "Application performance", op: "app", data: {} },
          { description: "Application performance", op: "app", data: {} },
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
});
