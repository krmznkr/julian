# Julian

A calm, browser-based full-year calendar focused on all-day, multi-day, and
timed events. It connects to Google Calendar and Google Tasks through OAuth,
then renders the whole year as a navigable grid.

## Run Locally

Prerequisites: Node 24 and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/krmznkr/julian.git
cd julian
pnpm install
pnpm dev
```

Open the URL printed by Vite, normally `http://127.0.0.1:3000`.

## Google OAuth and deployment

The public Google Cloud project is `krmznkr-julian`. `VITE_GOOGLE_CLIENT_ID` is
public by design. `GOOGLE_CLIENT_SECRET` is confidential and exists only in the
personal 1Password vault and the Cloudflare Worker secret store; never put it in
an `.env` file or give it a `VITE_` prefix.

Production uses `https://julian.krmznkr.com/auth/callback`. Local browser builds
use their own origin plus `/auth/callback`; the configured development callbacks
are `http://localhost:5173/auth/callback` and
`http://localhost:3000/auth/callback`.

Pushes to `main` deploy automatically: the Deploy GitHub Actions workflow
builds, verifies no client secret leaked into `dist/`, and publishes the
Worker with wrangler using the `CLOUDFLARE_API_TOKEN` repository secret.
For manual deploys:

```bash
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
./scripts/deploy-web.sh
```

## Documentation

- [`docs/README.md`](docs/README.md) — documentation map and ownership.
- [`docs/architecture.md`](docs/architecture.md) — system context, edge request
  pipeline, OAuth sequence, calendar/task data flow, browser storage,
  deployment, and failure behavior.
- [`docs/development.md`](docs/development.md) — local setup and command guide.
- [`docs/security.md`](docs/security.md) — threat model, edge hardening, and
  production smoke tests.
- [`docs/follow-ups.md`](docs/follow-ups.md) — known gaps, gotchas, tuning
  knobs, and deliberate deferrals.

## Security

The deployment is hardened in code: bot filtering, per-IP rate limiting, an
OAuth-proxy origin lock, response security headers (CSP/HSTS/…), and search
de-indexing. Design, tuning, and verification steps are documented in
[`docs/security.md`](docs/security.md).

## Tech Stack

- **Frontend:** Vite + React 19 + TanStack Router
- **UI:** Tailwind CSS 4, Radix UI
- **Data:** Google Calendar and Google Tasks APIs; browser-local OAuth tokens
  and UI preferences

## Quality Checks

```bash
pnpm typecheck
pnpm test:run
pnpm build
```

Use [`CONTRIBUTING.md`](CONTRIBUTING.md) for contribution checks,
[`SUPPORT.md`](SUPPORT.md) for usage help, and [`SECURITY.md`](SECURITY.md) for
private vulnerability reporting.

## License

MIT
