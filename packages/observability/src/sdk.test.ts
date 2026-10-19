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
    expect(payload).toContain("/other");
    await Sentry.close();
  });
});
