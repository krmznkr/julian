import * as Sentry from "@sentry/browser";
import posthog from "posthog-js/dist/module.slim";
import { POSTHOG_KEY, sanitizePostHogEvent, sanitizeSentryEvent, sanitizeSpan } from "./privacy";

// Public ingestion identifiers, not API/auth tokens. See docs/observability.md.
const SENTRY_DSN =
  "https://ac6d42a09e387ccbd1f541b47fa460fe@o4511769287000064.ingest.de.sentry.io/4511769300762704";

export const initialize = (release: string): ((error: unknown) => void) => {
  Sentry.init({
    dsn: SENTRY_DSN,
    release,
    environment: "production",
    sendDefaultPii: false,
    defaultIntegrations: false,
    integrations: [
      Sentry.globalHandlersIntegration(),
      Sentry.browserApiErrorsIntegration(),
      Sentry.browserTracingIntegration({ traceFetch: false, traceXHR: false }),
    ],
    tracesSampleRate: 0.05,
    tracePropagationTargets: [],
    sendClientReports: false,
    enableLogs: false,
    beforeBreadcrumb: () => null,
    beforeSend: (event) => sanitizeSentryEvent(event, release),
    beforeSendTransaction: (event) => sanitizeSentryEvent(event, release),
    beforeSendSpan: sanitizeSpan,
  });
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
