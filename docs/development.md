# Development

Julian is a Vite/React browser app served in production by a Cloudflare Worker.
The browser owns the UI and calls Google Calendar/Tasks directly; the Worker
serves assets, applies request protections, and proxies only OAuth token
exchange and refresh.

## Requirements

- Node 24
- pnpm 10

## Repository layout

A pnpm workspace orchestrated by Turborepo:

| Path                | Package            | Purpose                                                 |
| ------------------- | ------------------ | ------------------------------------------------------- |
| `apps/web`          | `@julian/web`      | The Vite/React calendar app                             |
| `apps/edge`         | `@julian/edge`     | Cloudflare Worker: assets, OAuth proxy, protections     |
| `apps/e2e`          | `@julian/e2e`      | Playwright, axe, and Lighthouse checks on the web build |
| `packages/domain`   | `@julian/domain`   | Pure calendar logic: dates, events, year-grid layout    |
| `packages/google`   | `@julian/google`   | Effect services for Google OAuth, Calendar, and Tasks   |
| `packages/security` | `@julian/security` | Security headers shared by the Worker and the web build |
| `packages/config`   | `@julian/config`   | Shared TypeScript configuration                         |

Linting, formatting, and dead-code checks run once from the root across every
package. Build, typecheck, and tests run per package through Turborepo, which
caches results that did not change.

## Commands

| Command                | Purpose                                          |
| ---------------------- | ------------------------------------------------ |
| `pnpm dev`             | Start the local Vite dev server                  |
| `pnpm build`           | Build every package                              |
| `pnpm typecheck`       | TypeScript + Effect diagnostics, every package   |
| `pnpm test:run`        | Unit tests, every package                        |
| `pnpm test:coverage`   | Unit tests with per-package coverage thresholds  |
| `pnpm test:tz:dates`   | Date tests across five time zones                |
| `pnpm test:e2e`        | Playwright end-to-end and axe accessibility      |
| `pnpm test:lighthouse` | Lighthouse CI against the production build       |
| `pnpm quality:static`  | Lint, format, dead code, functional rules, types |

Run one package's script with a filter, e.g. `pnpm --filter @julian/web preview`.

## End-to-end and web-quality checks

`apps/e2e` tests the production build, not the dev server. Both commands build
`@julian/web` first through Turborepo. No Google credentials are needed: every
test drives the landing page's live demo, which runs the real year view on
sample data.

```bash
pnpm --filter @julian/e2e exec playwright install chromium   # once
pnpm test:e2e
pnpm test:lighthouse
```

- **Playwright** serves `apps/web/dist` with `vite preview` on port 4173 and
  covers the demo, grid keyboard navigation, creating/renaming/deleting an
  event, the theme toggle, and a mobile viewport. The clock is pinned so the
  sample year is deterministic. Open the last run with
  `pnpm --filter @julian/e2e exec playwright show-report`; failed tests keep a
  trace in `apps/e2e/test-results`.
- **axe** (`src/a11y.spec.ts`) fails on any serious or critical violation. The
  moderate findings that remain are listed, with reasons, at the top of that
  file.
- **Lighthouse CI** (`lighthouserc.json`) runs three mobile-emulated passes and
  asserts performance ≥ 0.9, accessibility ≥ 0.95, and best practices ≥ 0.95.
  SEO is not asserted: the site is deliberately `noindex`. It needs a local
  Chrome; reports land in `apps/e2e/.lighthouseci`.

Reports and traces are git-ignored. In CI, both run as separate jobs; the
Playwright report and traces are uploaded when a test fails, and the
Lighthouse reports on every run.

## Local OAuth

Copy the public client-ID placeholder and fill it with the configured web client
ID:

```bash
cp .env.example .env
pnpm dev
```

The Vite server is fixed to `http://127.0.0.1:3000`. Google OAuth must list the
matching origin and `http://127.0.0.1:3000/auth/callback` redirect.

Vite serves the browser application only; it does not run `apps/edge/src/index.ts`.
The OAuth token exchange therefore requires the Worker proxy. Use the deployed
application for an ordinary end-to-end OAuth check, or build and run Wrangler
locally with its local-secret mechanism when specifically testing the Worker.
The confidential Google client secret is never a Vite variable and must not be
committed or given a `VITE_` prefix.

## Data and state

After OAuth, the browser loads calendars and year events from Google Calendar
and due tasks from Google Tasks. OAuth tokens, hidden-calendar selection,
sidebar state, and theme preferences are stored in browser local storage.
There is no Julian database.

## Architecture

See [`architecture.md`](architecture.md) for the runtime boundaries, request
pipeline, OAuth and refresh sequence, calendar mapping/rendering flow, and
deployment topology.

## Security

Production hardening (bot filtering, rate limiting, OAuth origin lock, security
headers, de-indexing) is documented in [`security.md`](security.md).
