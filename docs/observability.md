# Observability

Julian uses the existing `krmznkr/julian` Sentry project for browser errors and
5% sampled performance traces, and the EU PostHog project `228794` for page views
and page leaves. Every PostHog event has `app=julian` and
`environment=production`. The project is shared with Me and Life; filter both
properties when querying Julian and leave the other apps' settings alone.

## Runtime and privacy

`packages/observability` is shared by the React app and the static home, privacy
and terms pages. It imports the SDKs only for a production build with
`APP_CHANNEL=stable` served from `https://julian.krmznkr.com`. Development,
nightly, PR previews, local production builds and unknown hosts send nothing.
Blocked SDK downloads never prevent the calendar from mounting.

The configuration follows the public `krmznkr/me` setup, with stricter payload
allowlists for an app that handles personal calendar data:

- Sentry disables default integrations, breadcrumbs, session tracking, replay,
  logs, metrics and client reports. Only global errors, caught React render errors, browser API errors and browser
  performance tracing are enabled. Fetch/XHR tracing is disabled and trace
  headers are never propagated to Google or the OAuth endpoints.
- Sentry 11 replaced `sendDefaultPii` with `dataCollection`, which collects
  every category unless told otherwise. Its `userInfo` default tells Sentry to
  infer the IP address and user agent. Julian sets every category off: user
  info, cookies, headers, bodies, query strings, GraphQL, AI and MCP content,
  database and queue data, stack-frame variables and source context lines.
- Error messages and exception values become a fixed label. Only built-in error
  types, static app JS filenames, stack line/column positions, generated IDs,
  release and timing fields survive. Function names, source context, local
  variables, error causes, user objects, arbitrary contexts, tags, extra data,
  breadcrumbs, request cookies/headers/bodies and external API URLs are dropped.
- Transactions and spans pass the same allowlists. Queries and fragments never
  survive. Page paths become static categories such as `/calendar`, `/demo` and
  `/auth/callback`; unknown paths become `/other`. Selected years, days, search
  text, event/calendar titles, emails and OAuth values are not telemetry.
  Sentry runs with span streaming (`traceLifecycle: "stream"`, the Sentry 11
  default, pinned because the span hook only runs for the configured span
  shape). Every span passes the span hook. Pageload and navigation roots
  become their static route category; child spans keep a fixed label. Each
  span keeps only its generated IDs, timings, an ok/error status, the release,
  `environment=production`, `op=app`, the generated segment ID and, on roots,
  the static route category as the segment name. Names, URLs, user fields, DOM
  selectors, status messages and links are dropped. Streamed web-vital spans
  are named from a component name or a fixed fallback, not DOM selectors that
  could contain an `aria-label`, and the span hook renames them anyway. The
  envelope's `trace` header copies a root span's name unless Sentry derived it
  from the URL; the span hook cannot reach that header, so a small integration
  deletes the name whenever Sentry builds the header. The static span shape
  used by transaction events passes an equivalent allowlist.
- PostHog uses its slim bundle with memory-only anonymous IDs and persistence
  disabled. It writes no analytics cookies or local storage, never identifies a
  person and respects Do Not Track. Autocapture, exceptions, session recording,
  heatmaps, performance capture, dead clicks, surveys, feature flags, remote
  config and external dependency loading are disabled. Text and attributes are
  masked. Referrers, campaign parameters, document titles, device properties,
  person properties and arbitrary event properties are dropped before sending.
  Only pageview/pageleave, a transient generated ID, the public project key,
  static route category and fixed app/environment/privacy flags survive.

There is no server-side Sentry SDK. The edge Worker handles OAuth codes,
refresh tokens and the confidential client secret; collecting request/error
objects there would widen the privacy boundary. Cloudflare's existing
operational logs remain the edge diagnostic source. Shared CSP headers allow
only Julian's Sentry ingest host and the PostHog EU ingest host, without remote
script permissions.

The DSN and `phc_` key in the source are public ingestion identifiers. The DSN
was read from `/api/0/projects/krmznkr/julian/keys/` in the personal Sentry
session. They are not API credentials. Never put Sentry or PostHog private API
tokens in a `VITE_` variable or the browser bundle.

## Source maps and deployments

Nightly and Deploy stable set the build-only `JULIAN_SOURCEMAPS=true` flag.
Vite generates hidden source maps for both the app and marketing scripts.
Turborepo includes that flag in its build cache key. Normal local, CI and
preview builds generate no maps.

After the build, the workflows run the pinned `@sentry/cli` through
`pnpm --filter @julian/web sentry:sourcemaps`. It injects debug IDs and uploads
all JS/maps in the combined `apps/web/dist` to organization `krmznkr`, project
`julian`, with the build commit as `SENTRY_RELEASE`. Runtime release values use
the same seven-character build commit. Source-map debug metadata is preserved
only for static app JS files and generated debug IDs.

Only the upload step receives the existing `SENTRY_AUTH_TOKEN` repository
secret. A missing token, missing maps or failed upload stops deployment. An
EXIT trap deletes every `.map` even on failure; successful uploads also delete
maps and assert none remain before publishing Workers assets. No token or map
is required for ordinary development.

## Verification

Privacy regression tests feed calendar titles, emails and OAuth secrets into
request URLs, fragments, errors, stack frames, contexts, span data, streamed
span attributes and PostHog properties. One test runs the real SDK with the
production options and checks every envelope it would send. Production-gate tests cover local, preview, nightly and unknown
hosts. SDK configuration tests lock down the disabled collection features.

After a stable release, the release owner should:

1. Confirm the upload step succeeded and no deployed `.map` URL is public.
2. Confirm the build commit appears in Sentry with its private source maps.
3. Exercise the app and check the Sentry Issues feed. Do not inject real
   calendar data into a verification error.
4. Check that a sampled trace arrives in Sentry's trace explorer with a static
   route name such as `/demo`. Sentry 11 streams spans in a newer envelope
   format, and local tests cannot prove the project accepts it. Traces are
   sampled at 5%, so this can take several page loads.
5. Check PostHog Activity for `$pageview` with `app=julian` and
   `environment=production`; inspect properties for the documented allowlist.
6. Check that nightly and PR previews send no telemetry.

Ingestion and source-map processing require the deployment to run. Local tests
cannot prove either service accepted events. Because anonymous IDs disappear
on reload and person profiles are disabled, avoid stable-user and unique-visitor
claims when reporting traffic.
