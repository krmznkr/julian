import * as Sentry from "@sentry/browser";
import type { BrowserOptions } from "@sentry/browser";
import posthog from "posthog-js/dist/module.slim";
import {
  POSTHOG_KEY,
  sanitizePostHogEvent,
  sanitizeSentryEvent,
  sanitizeStreamedSpan,
} from "./privacy";

// Public ingestion identifiers, not API/auth tokens. See docs/observability.md.
const SENTRY_DSN =
  "https://ac6d42a09e387ccbd1f541b47fa460fe@o4511769287000064.ingest.de.sentry.io/4511769300762704";

// Sentry 11 removed `sendDefaultPii`. Its replacement, `dataCollection`,
// collects every category by default; `userInfo: true` even tells Sentry to
// infer the IP address and user agent. Turn every category off.
const SENTRY_DATA_COLLECTION = {
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
} as const satisfies BrowserOptions["dataCollection"];

export const sentryOptions = (release: string): BrowserOptions => ({
  dsn: SENTRY_DSN,
  release,
  environment: "production",
  dataCollection: SENTRY_DATA_COLLECTION,
  // Streaming is the v11 default; pin it because beforeSendSpan only runs for
  // the span shape of the configured lifecycle. Streamed web vital spans also
  // use fixed names instead of DOM selectors, which can include aria-labels.
  // Streaming builds no transaction events, so beforeSendTransaction is unused.
  traceLifecycle: "stream",
  defaultIntegrations: false,
  integrations: [
    Sentry.globalHandlersIntegration(),
    Sentry.browserApiErrorsIntegration(),
    Sentry.browserTracingIntegration({ traceFetch: false, traceXHR: false }),
  ],
  tracesSampleRate: 0.05,
  tracePropagationTargets: [],
  sendClientReports: false,
  // v11 removed `enableLogs`; logs and metrics are on whenever code calls the
  // logger or metrics APIs. Julian calls neither, and drops any that appear.
  beforeSendLog: () => null,
  beforeSendMetric: () => null,
  beforeBreadcrumb: () => null,
  beforeSend: (event) => sanitizeSentryEvent(event, release),
  beforeSendSpan: (span) => sanitizeStreamedSpan(span, release),
});

export const initialize = (release: string): ((error: unknown) => void) => {
  Sentry.init(sentryOptions(release));
  posthog.init(POSTHOG_KEY, {
    api_host: "https://eu.i.posthog.com",
    ui_host: "https://eu.posthog.com",
    defaults: "2026-05-30",
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
    ip: false,
    save_referrer: false,
    save_campaign_params: false,
    mask_all_text: true,
    mask_all_element_attributes: true,
    before_send: sanitizePostHogEvent,
  });
  return (error) => {
    Sentry.captureException(error);
  };
};
