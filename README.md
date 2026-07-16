# Julian

A calm, browser-based full-year calendar view focused on all-day and multi-day events. Built as a single Vite + React app with local sample data.

## Run Locally

Prerequisites: Node 24 and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/krmznkr/julian.git
cd julian
pnpm install
pnpm dev
```

Open the URL printed by Vite, usually `http://127.0.0.1:5173`.

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

## Security

The deployment is hardened in code: bot filtering, per-IP rate limiting, an
OAuth-proxy origin lock, response security headers (CSP/HSTS/…), and search
de-indexing. Design, tuning, and verification steps are documented in
[`docs/security.md`](docs/security.md).

## Tech Stack

- **Frontend:** Vite + React 19 + TanStack Router
- **UI:** Tailwind CSS 4, Radix UI
- **Data:** Local browser/sample calendar data

## Quality Checks

```bash
pnpm typecheck
pnpm test:run
pnpm build
```

## License

MIT
