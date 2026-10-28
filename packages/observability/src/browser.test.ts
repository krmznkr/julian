import type { BrowserOptions } from "@sentry/browser";
import type { PostHogConfig } from "posthog-js";
import { sanitizePostHogEvent } from "./privacy";
import { describe, expect, it, vi } from "vitest";

const { sentryInit, posthogInit, captureException } = vi.hoisted(() => ({
  captureException: vi.fn<(error: unknown) => void>(),
  sentryInit: vi.fn<(options: BrowserOptions) => void>(),
  posthogInit: vi.fn<(key: string, options: Partial<PostHogConfig>) => void>(),
}));
vi.mock("@sentry/browser", () => ({
  init: sentryInit,
  captureException,
  globalHandlersIntegration: () => "global-handlers",
  browserApiErrorsIntegration: () => "browser-errors",
  browserTracingIntegration: (options: unknown) => options,
}));
vi.mock("posthog-js/dist/module.slim", () => ({ default: { init: posthogInit } }));
import { initialize } from "./browser";

describe("SDK privacy configuration", () => {
  it("disables content collection, storage, identities and auxiliary SDK requests", async () => {
    const reportError = initialize("sha");
    const error = new Error("sensitive message");
    reportError(error);
    expect(captureException).toHaveBeenCalledExactlyOnceWith(error);
    const sentry = sentryInit.mock.calls[0]![0];
    expect(sentry).toMatchObject({
      environment: "production",
      release: "sha",
      traceLifecycle: "stream",
      defaultIntegrations: false,
      tracesSampleRate: 0.05,
      tracePropagationTargets: [],
      sendClientReports: false,
      integrations: [
        "global-handlers",
        "browser-errors",
        { traceFetch: false, traceXHR: false },
        expect.objectContaining({ name: "JulianDropTraceTransactionName" }),
      ],
    });
    // Sentry 11 replaced sendDefaultPii with dataCollection, which defaults to on.
    expect(sentry.dataCollection).toEqual({
      userInfo: false,
      cookies: false,
      httpHeaders: false,
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
    // Ignored by span streaming, and v11 warns in the console when it is set.
    expect(sentry).not.toHaveProperty("beforeSendTransaction");
    expect(sentry.beforeBreadcrumb?.({ message: "private" }, {})).toBeNull();
    expect(sentry.beforeSendLog?.({ level: "info", message: "private" })).toBeNull();
    expect(
      sentry.beforeSendMetric?.({ name: "private", type: "counter", value: 1, attributes: {} }),
    ).toBeNull();
    expect(
      await sentry.beforeSend?.({ type: undefined, message: "private" }, {}),
    ).not.toHaveProperty("message");
    expect(
      sentry.beforeSendSpan?.({
        trace_id: "a".repeat(32),
        span_id: "b".repeat(16),
        name: "Navigation",
        start_timestamp: 1,
        end_timestamp: 2,
        status: "ok",
        is_segment: true,
        attributes: { "url.full": "https://julian.krmznkr.com/2026?code=secret" },
      }),
    ).toMatchObject({ name: "/calendar", attributes: { "sentry.release": "sha" } });
    expect(posthogInit.mock.calls[0]?.[1]).toMatchObject({
      api_host: "https://eu.i.posthog.com",
      autocapture: false,
      capture_pageview: "history_change",
      capture_pageleave: true,
      capture_dead_clicks: false,
      capture_exceptions: false,
      capture_heatmaps: false,
      capture_performance: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_persistence: true,
      persistence: "memory",
      person_profiles: "never",
      respect_dnt: true,
      advanced_disable_flags: true,
      advanced_disable_feature_flags: true,
      advanced_disable_feature_flags_on_first_load: true,
      disable_external_dependency_loading: true,
      save_referrer: false,
      save_campaign_params: false,
      mask_all_text: true,
      mask_all_element_attributes: true,
    });
    expect(posthogInit.mock.calls[0]?.[1].before_send).toBe(sanitizePostHogEvent);
  });
});
