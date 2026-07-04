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
the redirect on `http://localhost:8124`. Add that exact URI to the OAuth client's
**Authorized redirect URIs** in the Google Cloud Console (alongside the existing
`http://localhost:3000/auth/callback`) for desktop login to work.

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
