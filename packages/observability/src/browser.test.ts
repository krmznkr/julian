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
      sendDefaultPii: false,
      defaultIntegrations: false,
      tracesSampleRate: 0.05,
      tracePropagationTargets: [],
      sendClientReports: false,
      enableLogs: false,
      integrations: ["global-handlers", "browser-errors", { traceFetch: false, traceXHR: false }],
    });
    expect(sentry.beforeBreadcrumb?.({ message: "private" }, {})).toBeNull();
    expect(
      await sentry.beforeSend?.({ type: undefined, message: "private" }, {}),
    ).not.toHaveProperty("message");
    expect(
      await sentry.beforeSendTransaction?.(
        { type: "transaction", transaction: "/2026?code=secret" },
        {},
      ),
    ).toMatchObject({ transaction: "/calendar" });
    expect(sentry.beforeSendSpan).toBeDefined();
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
