# Julian

A calm, browser-based full-year calendar view focused on all-day and multi-day events. Built as a single Vite + React app with local sample data.

## Run Locally

Prerequisites: Node 24 and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/krmznkr/krmznkr-monorepo.git
cd krmznkr-monorepo/julian
pnpm install
pnpm dev
```

Open the URL printed by Vite, usually `http://127.0.0.1:5173`.

## Desktop App (macOS)

Julian can run as a native desktop app via a thin [Tauri](https://tauri.app) shell
(`src-tauri/`) around the same Vite build — no separate backend.

```bash
pnpm tauri:dev     # run the desktop app in development
pnpm tauri:build   # produce Julian.app + a .dmg in src-tauri/target/release/bundle
```

The unsigned build trips macOS Gatekeeper on first launch — right-click the app and
choose **Open** once to allow it.

**Google sign-in:** unlike the browser, the desktop app can't redirect inside its own
webview (Google blocks embedded webviews), so it opens the system browser and catches
the redirect on `http://localhost:8124`. The desktop exchange uses PKCE and does not
embed a client secret.

## Google OAuth and deployment

The public Google Cloud project is `krmznkr-julian`. `VITE_GOOGLE_CLIENT_ID` is
public by design. `GOOGLE_CLIENT_SECRET` is confidential and exists only in the
personal 1Password vault and the Cloudflare Worker secret store; never put it in
an `.env` file or give it a `VITE_` prefix.

Production uses `https://julian.krmznkr.com/auth/callback`. Local browser builds
use their own origin plus `/auth/callback`; the configured development callbacks
are `http://localhost:5173/auth/callback` and
`http://localhost:3000/auth/callback`.

```bash
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
./scripts/deploy-web.sh
```

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
