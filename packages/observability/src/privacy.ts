import type { Event, BrowserOptions, StackFrame } from "@sentry/browser";
import type { CaptureResult } from "posthog-js";

// Sentry 11 has two span shapes. Transaction events (and `traceLifecycle:
// "static"`) carry SpanJSON. Span streaming, the v11 default and the mode
// browser.ts sets, passes every span to beforeSendSpan as a StreamedSpanJSON.
export type SpanJSON = NonNullable<Event["spans"]>[number];
export type StreamedSpanJSON = Parameters<NonNullable<BrowserOptions["beforeSendSpan"]>>[0];

export const POSTHOG_KEY = "phc_mptDs49YvTafSLXfgGhpUvHeEDq7uNVaiMcd3VyTiN8j";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const hexId = (value: string | undefined, size: number): string | undefined =>
  value && new RegExp(`^[a-f0-9]{${size}}$`, "i").test(value) ? value : undefined;

export const PRODUCTION_ORIGIN = "https://julian.krmznkr.com";

// Even a pathname can contain an email, event title or token. Return only static
// route categories, never arbitrary URL text or calendar navigation state.
export const pagePath = (value: unknown): string => {
  if (typeof value !== "string") return "/other";
  try {
    const url = new URL(value, PRODUCTION_ORIGIN);
    if (url.origin !== PRODUCTION_ORIGIN) return "/other";
    const path = url.pathname;
    if (
      ["/", "/home", "/privacy", "/terms", "/auth/callback", "/calendar", "/other"].includes(path)
    )
      return path;
    if (/^\/demo(?:\/\d{4}(?:\/\d{2})?)?\/?$/.test(path)) return "/demo";
    if (/^\/(?:year\/)?\d{4}(?:\/\d{2})?\/?$/.test(path)) return "/calendar";
    return "/other";
  } catch {
    return "/other";
  }
};

const assetUrl = (value: string | undefined): string | undefined => {
  try {
    const url = new URL(value ?? "", PRODUCTION_ORIGIN);
    return url.origin === PRODUCTION_ORIGIN &&
      /^\/(?:assets|_marketing)\/[a-zA-Z0-9_-]+\.js$/.test(url.pathname)
      ? `${PRODUCTION_ORIGIN}${url.pathname}`
      : undefined;
  } catch {
    return undefined;
  }
};

const safeFrame = (frame: StackFrame): StackFrame[] => {
  const filename = assetUrl(frame.filename);
  return filename ? [{ filename, lineno: frame.lineno, colno: frame.colno, in_app: true }] : [];
};

// Status codes are a closed set, but a custom status message is free text that
// the SDK copies into the static status field.
const SPAN_STATUSES = new Set([
  "ok",
  "cancelled",
  "unknown_error",
  "invalid_argument",
  "deadline_exceeded",
  "not_found",
  "already_exists",
  "permission_denied",
  "resource_exhausted",
  "failed_precondition",
  "aborted",
  "out_of_range",
  "unimplemented",
  "internal_error",
  "unavailable",
  "data_loss",
  "unauthenticated",
]);

const CHILD_SPAN_NAME = "Application performance";

// Build new objects rather than redacting known keys. SDK additions and nested
// error causes must not silently expand the data contract.
export const sanitizeSpan = (span: SpanJSON): SpanJSON => ({
  trace_id: hexId(span.trace_id, 32) ?? "0".repeat(32),
  span_id: hexId(span.span_id, 16) ?? "0".repeat(16),
  parent_span_id: hexId(span.parent_span_id, 16),
  start_timestamp: span.start_timestamp,
  timestamp: span.timestamp,
  op: "app",
  status: SPAN_STATUSES.has(span.status) ? span.status : "internal_error",
  // In static mode Sentry applies this hook to transaction roots before
  // beforeSendTransaction. Its segment marker also identifies roots that have
  // an upstream parent.
  description: span.is_segment === true ? pagePath(span.description) : CHILD_SPAN_NAME,
  data: {},
});

// Sentry sends a span unmodified if beforeSendSpan throws, so tolerate a span
// without attributes even though the type requires them.
const stringAttribute = (span: StreamedSpanJSON, key: string): string | undefined => {
  const attributes: Readonly<Record<string, unknown>> | undefined = span.attributes;
  const value = attributes?.[key];
  return typeof value === "string" ? value : undefined;
};

// Streamed spans carry what transaction events used to: release, environment,
// user, URL and SDK details are all attributes, and the status message moves
// to an attribute too. Keep only fixed values, the release we set and the
// generated segment ID that links a span to its root.
export const sanitizeStreamedSpan = (span: StreamedSpanJSON, release: string): StreamedSpanJSON => {
  const segment = span.is_segment === true;
  const segmentId = hexId(stringAttribute(span, "sentry.segment.id"), 16);
  // Streamed pageload and navigation roots are named "Pageload" and
  // "Navigation"; the page URL is an attribute. Reduce it to a route category.
  const name = segment
    ? pagePath(stringAttribute(span, "url.full") ?? stringAttribute(span, "url.path") ?? span.name)
    : CHILD_SPAN_NAME;
  return {
    trace_id: hexId(span.trace_id, 32) ?? "0".repeat(32),
    span_id: hexId(span.span_id, 16) ?? "0".repeat(16),
    parent_span_id: hexId(span.parent_span_id, 16),
    name,
    start_timestamp: span.start_timestamp,
    end_timestamp: span.end_timestamp,
    status: span.status === "ok" ? "ok" : "error",
    is_segment: segment,
    attributes: {
      "sentry.op": "app",
      "sentry.release": release,
      "sentry.environment": "production",
      ...(segmentId ? { "sentry.segment.id": segmentId } : {}),
      // The name is now a static category, not a URL Sentry should re-derive.
      ...(segment ? { "sentry.segment.name": name, "sentry.segment.name.source": "route" } : {}),
    },
  };
};

export const sanitizeSentryEvent = <T extends Event>(event: T, release: string): T =>
  ({
    event_id: hexId(event.event_id, 32),
    timestamp: event.timestamp,
    platform: "javascript",
    environment: "production",
    release,
    type: event.type,
    level: event.type === "transaction" ? undefined : "error",
    tags: { app: "julian" },
    request: event.request
      ? { url: `${PRODUCTION_ORIGIN}${pagePath(event.request.url)}` }
      : undefined,
    // Keep trace correlation, discard browser/device and arbitrary contexts.
    contexts: event.contexts?.trace
      ? {
          trace: {
            trace_id: hexId(event.contexts.trace.trace_id, 32),
            span_id: hexId(event.contexts.trace.span_id, 16),
            op: "app",
          },
        }
      : undefined,
    transaction: event.type === "transaction" ? pagePath(event.transaction) : undefined,
    start_timestamp: event.start_timestamp,
    spans: event.spans?.map(sanitizeSpan),
    exception: event.exception
      ? {
          values: event.exception.values?.map((error) => ({
            type: [
              "Error",
              "TypeError",
              "RangeError",
              "ReferenceError",
              "SyntaxError",
              "URIError",
              "EvalError",
            ].includes(error.type ?? "")
              ? error.type
              : "Error",
            value: "Unhandled application error",
            stacktrace: error.stacktrace
              ? { frames: error.stacktrace.frames?.flatMap(safeFrame) }
              : undefined,
          })),
        }
      : undefined,
    // Debug IDs are required for private source maps. Keep only generated IDs
    // attached to our static JS; never preserve an arbitrary code_file.
    debug_meta: event.debug_meta
      ? {
          images: event.debug_meta.images?.flatMap((image) => {
            const codeFile = assetUrl(image.code_file);
            return codeFile && image.debug_id && UUID.test(image.debug_id)
              ? [{ type: "sourcemap", code_file: codeFile, debug_id: image.debug_id }]
              : [];
          }),
        }
      : undefined,
  }) as unknown as T;

export const sanitizePostHogEvent = (event: CaptureResult | null): CaptureResult | null => {
  if (!event || !["$pageview", "$pageleave"].includes(event.event)) return null;
  if (
    !UUID.test(event.uuid) ||
    typeof event.properties.distinct_id !== "string" ||
    !UUID.test(event.properties.distinct_id)
  )
    return null;
  return {
    event: event.event,
    uuid: event.uuid,
    properties: {
      // SDK-generated anonymous ID lives in memory for this page only. Never
      // call identify(), register() or pass application state to this client.
      distinct_id: event.properties.distinct_id,
      token: POSTHOG_KEY,
      $current_url: `${PRODUCTION_ORIGIN}${pagePath(event.properties.$current_url)}`,
      $pathname: pagePath(event.properties.$current_url),
      $process_person_profile: false,
      $geoip_disable: true,
      $ip: null,
      app: "julian",
      environment: "production",
    },
  };
};
