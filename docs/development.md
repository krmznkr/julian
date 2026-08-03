# Development

Julian is a Vite/React browser app served in production by a Cloudflare Worker.
The browser owns the UI and calls Google Calendar/Tasks directly; the Worker
serves assets, applies request protections, and proxies only OAuth token
exchange and refresh.

## Requirements

- Node 24
- pnpm 10

## Commands

| Command              | Purpose                         |
| -------------------- | ------------------------------- |
| `pnpm dev`           | Start the local Vite dev server |
| `pnpm build`         | Build the browser app           |
| `pnpm preview`       | Preview the production build    |
| `pnpm typecheck`     | Run TypeScript checks           |
| `pnpm test:run`      | Run unit tests                  |
| `pnpm quality:static` | Run static quality checks       |

## Local OAuth

Copy the public client-ID placeholder and fill it with the configured web client
ID:

```bash
cp .env.example .env
pnpm dev
```

The Vite server is fixed to `http://127.0.0.1:3000`. Google OAuth must list the
matching origin and `http://127.0.0.1:3000/auth/callback` redirect.

Vite serves the browser application only; it does not run `worker/index.ts`.
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
