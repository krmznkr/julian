# Development

Julian is a Vite/Foldkit browser app served in production by a Cloudflare Worker.
The browser owns the UI and calls Google Calendar/Tasks directly; the Worker
serves assets, applies request protections, and proxies only OAuth token
exchange and refresh.

## Requirements

- Node 24.15.0 (pinned in `package.json` `engines.node`; CI reads it from there)
- Bun 1.4.4 (pinned in `package.json` `packageManager`; CI reads it from there)

## Repository layout

A Bun workspace orchestrated by Turborepo:

| Path                     | Package                 | Purpose                                                 |
| ------------------------ | ----------------------- | ------------------------------------------------------- |
| `apps/web`               | `@julian/web`           | The Vite/Foldkit calendar app                             |
| `apps/marketing`         | `@julian/marketing`     | Static marketing, privacy, and terms pages              |
| `apps/edge`              | `@julian/edge`          | Cloudflare Worker: assets, OAuth proxy, protections     |
| `apps/e2e`               | `@julian/e2e`           | Playwright, axe, and Lighthouse checks on the web build |
| `packages/domain`        | `@julian/domain`        | Pure calendar logic: dates, events, year-grid layout    |
| `packages/google`        | `@julian/google`        | Effect services for Google OAuth, Calendar, and Tasks   |
| `packages/security`      | `@julian/security`      | Security headers and the session-hint cookie            |
| `packages/observability` | `@julian/observability` | Shared browser telemetry and privacy boundaries         |
| `packages/release`       | `@julian/release`       | Version and channel metadata for each build             |
| `packages/config`        | `@julian/config`        | Shared TypeScript configuration                         |

Linting, formatting, and dead-code checks run once from the root across every
package. Build, typecheck, and tests run per package through Turborepo, which
caches results that did not change.

## Commands

| Command                   | Purpose                                          |
| ------------------------- | ------------------------------------------------ |
| `bun run dev`             | Start the local Vite dev server                  |
| `bun run build`           | Build every package                              |
| `bun run typecheck`       | TypeScript + Effect diagnostics, every package   |
| `bun run test:run`        | Unit tests, every package                        |
| `bun run test:coverage`   | Unit tests with per-package coverage thresholds  |
| `bun run test:tz:dates`   | Date tests across five time zones                |
| `bun run test:e2e`        | Playwright end-to-end and axe accessibility      |
| `bun run test:lighthouse` | Lighthouse CI against the production build       |
| `bun run quality:static`  | Lint, format, dead code, functional rules, types |

Run one package's script with a filter, e.g. `bun run --cwd apps/web preview`.

## Foldkit frontend

The main entry point boots Foldkit 0.170.0 directly. `/demo` and signed-in
`/{year}` routes use the same Schema model, Messages, pure update and view.
The former `/foldkit.html` experiment redirects into `/demo`.

`src/foldkit/model.ts` defines state and Messages. `app.ts` handles transitions;
`commands.ts` executes Effects, and `subscriptions.ts` scopes browser listeners
to the runtime. Rendering lives in `view.ts`, `grid-view.ts`, `timeline-view.ts`
and `dialogs.ts`. Modal dialogs use Foldkit's scoped DOM helpers for focus,
scroll locking and background isolation.

The existing year-view data and event ports remain in
`src/components/year-view/year-view-ports.ts`. `CalendarPorts` supplies the
Google adapters or an Effect Ref store for the demo. Refreshes cancel stale
loads. Event writes run independently, and failed optimistic moves restore
only their event's dates. Demo edits, filters and sidebar preferences stay in
memory; signed-in preferences use browser storage.

Use the existing production Playwright suite to check keyboard, touch, print,
URLs and accessibility. The signed-in test intercepts Google requests with
sample responses and verifies rollback after a rejected write. Unit tests
exercise the update function, routing and mounted Foldkit runtime. The mounted
tests use fake timers and dispose their runtime after each case.

DevTools and its MCP bridge are disabled. Vite hot-model preservation is also
disabled because it would send calendar state to the development server;
source changes reload the app instead. Crash reporting passes only the
Error through Julian's existing telemetry wrapper, never the Model, Message
or OAuth callback URL. Pin reference examples to the installed
[`foldkit@0.170.0` tag](https://github.com/foldkit/foldkit/tree/foldkit%400.170.0/examples).

## End-to-end and web-quality checks

`apps/e2e` tests the production build, not the dev server. Both commands build
`@julian/web` (and with it the marketing pages) first through Turborepo. No
Google credentials are needed: the app tests drive `/demo`, which runs the real
year view on sample data.

```bash
bun run --cwd apps/e2e playwright install chromium   # once
bun run test:e2e
bun run test:lighthouse
```

- **Playwright** serves `apps/web/dist` with `vite preview` on port 4173
  (override with `E2E_PORT`) and
  covers the marketing pages (including footer links with at least 44×44 CSS pixel touch targets
  in both themes from 320px to 1440px, and the privacy page's permission URLs wrapping only at a
  slash, from a 320px phone to a 1440px desktop), the link-preview tags and share image, the URL scheme, the demo, grid keyboard navigation,
  search, moving events by drag and keyboard, the one-page print, creating/renaming/deleting an
  event, the theme toggle, shortcut-help labels for Linux, Windows and macOS (Ctrl or ⌘),
  day-number contrast in both themes, a Pixel 7 viewport with touch input, the
  narrow-screen Calendars drawer from the keyboard (focus, Tab, Escape, `/`, Ctrl/⌘K, resizing),
  the current month opening fully in view on phones, the demo banner and tour row staying compact on
  phones (month headers within the top 200px on a Pixel 7, nothing clipped at 320px), and a late-month today staying fully in view
  on load, under the arrow keys and beside the tour's day details on desktop and Pixel 7. The clock is pinned so the
  sample year is deterministic. Open the last run with
  `bun run --cwd apps/e2e playwright show-report`; failed tests keep a
  trace in `apps/e2e/test-results`.
- **axe** (`src/a11y.spec.ts`) fails on any serious or critical violation. It
  scans the demo with its banner and tour row visible and `/home`, `/privacy`,
  and `/terms` in light and dark themes on desktop and a Pixel 7 with touch input.
  Desktop scans also cover open day details and the event dialog, and a
  collapsed desktop sidebar must leave no empty "Calendars" landmark. The
  moderate findings that remain are listed, with reasons, at the top of that
  file.
- **Lighthouse CI** (`lighthouserc.json`) runs three mobile-emulated passes over
  `/demo` and the marketing home and
  asserts performance ≥ 0.9, accessibility ≥ 0.95, and best practices ≥ 0.95.
  SEO is not asserted: the site is deliberately `noindex`. It needs a local
  Chrome; reports land in `apps/e2e/.lighthouseci`.

Reports and traces are git-ignored. In CI, both run as separate jobs; the
Playwright report and traces are uploaded when a test fails, and the
Lighthouse reports on every run. The e2e job caches Playwright's headless
Chromium and the apt packages it needs, keyed by Ubuntu release and Playwright
version. A cold install was slow because of the Ubuntu mirror, not the browser
download. Lighthouse uses the Chrome that comes with the runner image.

CI runs on every pull request and every push to `main`. It can also be started
by hand (`gh workflow run ci.yml --ref main`) when a commit on `main` has no
run. See [Validating main by hand](releasing.md#validating-main-by-hand).

## Local OAuth

Copy the public client-ID placeholder and fill it with the configured web client
ID:

```bash
cp .env.example .env
bun run dev
```

The Vite dev server is fixed to `http://127.0.0.1:3000`. Open it at that exact
address: Google treats `http://localhost:3000` and `http://127.0.0.1:3000` as
different origins, and the redirect URI is derived from the address in the
browser bar.

Vite serves the browser application only; it does not run the Worker
(`apps/edge`), so the token exchange at `/api/oauth/*` has nothing to answer it
there. For a full local sign-in, run the built app under the Worker:

```bash
printf 'GOOGLE_CLIENT_SECRET=%s\n' "<secret>" > apps/edge/.dev.vars   # git-ignored
bun run build
bun run --cwd apps/edge dev        # wrangler dev on http://127.0.0.1:8787
```

Local `wrangler dev` runs with `APP_CHANNEL=dev`, the only channel whose origin
lock accepts `localhost` and `127.0.0.1`. The confidential client secret is
never a Vite variable and must not be committed or given a `VITE_` prefix.

The Google Cloud project is `krmznkr-julian`. `VITE_GOOGLE_CLIENT_ID` is public
by design; `GOOGLE_CLIENT_SECRET` lives only in the personal 1Password vault,
the Cloudflare Worker secret store and the `GOOGLE_CLIENT_SECRET` GitHub secret
(used by the nightly deploy). The OAuth client must list each origin you use as
a JavaScript origin and its `/auth/callback` as a redirect URI:

| Where                 | Origin                               | Redirect URI                                       |
| --------------------- | ------------------------------------ | -------------------------------------------------- |
| Production            | `https://julian.krmznkr.com`         | `https://julian.krmznkr.com/auth/callback`         |
| Nightly               | `https://julian-nightly.krmznkr.com` | `https://julian-nightly.krmznkr.com/auth/callback` |
| `wrangler dev`        | `http://127.0.0.1:8787`              | `http://127.0.0.1:8787/auth/callback`              |
| Vite dev (start only) | `http://127.0.0.1:3000`              | `http://127.0.0.1:3000/auth/callback`              |

Verified on 2026-10-19: production, nightly and both `127.0.0.1` origins and
callbacks above are registered in the production OAuth client. Earlier
`localhost:5173` and `localhost:3000` callbacks were retained. Google 2-step
verification is enabled on the public account.

## Data and state

After OAuth, the browser loads calendars and year events from Google Calendar
and due tasks from Google Tasks. OAuth tokens, hidden-calendar selection,
sidebar state, and theme preferences are stored in browser local storage.
There is no Julian database.

## Observability

Telemetry is disabled locally, in PR previews and on nightly. It runs only in a
stable production build on `julian.krmznkr.com`. No telemetry credentials are
needed for development. Privacy controls and private deployment source maps are
documented in [`observability.md`](observability.md).

## Architecture

See [`architecture.md`](architecture.md) for the runtime boundaries, request
pipeline, OAuth and refresh sequence, calendar mapping/rendering flow, and
deployment topology.

## Security

Production hardening (bot filtering, rate limiting, OAuth origin lock, security
headers, de-indexing) is documented in [`security.md`](security.md).
