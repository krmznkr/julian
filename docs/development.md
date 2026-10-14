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
| `packages/domain`   | `@julian/domain`   | Pure calendar logic: dates, events, year-grid layout    |
| `packages/google`   | `@julian/google`   | Effect services for Google OAuth, Calendar, and Tasks   |
| `packages/security` | `@julian/security` | Security headers shared by the Worker and the web build |
| `packages/config`   | `@julian/config`   | Shared TypeScript configuration                         |

Linting, formatting, and dead-code checks run once from the root across every
package. Build, typecheck, and tests run per package through Turborepo, which
caches results that did not change.

## Commands

| Command               | Purpose                                          |
| --------------------- | ------------------------------------------------ |
| `pnpm dev`            | Start the local Vite dev server                  |
| `pnpm build`          | Build every package                              |
| `pnpm typecheck`      | TypeScript + Effect diagnostics, every package   |
| `pnpm test:run`       | Unit tests, every package                        |
| `pnpm test:coverage`  | Unit tests with per-package coverage thresholds  |
| `pnpm test:tz:dates`  | Date tests across five time zones                |
| `pnpm quality:static` | Lint, format, dead code, functional rules, types |

Run one package's script with a filter, e.g. `pnpm --filter @julian/web preview`.

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
