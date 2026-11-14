# Julian

Julian shows a Google Calendar year on one screen: twelve month columns, events
laid out in lanes, Google Tasks on their due dates. It is keyboard-first, works
on phones, and prints the year on one landscape page.

These are defaults, not laws. The maintainer's instructions in a task win.

## What must not regress

- **Calendar data stays private.** The browser calls Google directly with its
  own token. There is no database and no server-side copy of anyone's calendar.
  Telemetry goes through the allowlists in `packages/observability`; calendar
  content, OAuth values and personal state never leave the browser by any other
  path.
- **The client secret never reaches the browser.** Only the edge Worker holds
  `GOOGLE_CLIENT_SECRET`. CI fails a build whose `apps/web/dist` contains a
  `GOCSPX-` string. Never add the secret to a `VITE_*` variable.
- **The demo runs the real app.** `/demo` plugs an in-memory store into the
  same year view through the ports in
  `apps/web/src/year-view/year-view-ports.ts`. A feature that only
  works signed in, or only in the demo, is unfinished.
- **Keyboard, screen reader, phone and print.** Every interaction needs a key,
  an accessible name, a touch layout and a sane print style. The e2e suite runs
  axe and fails on serious violations.
- **Dates are correct in every time zone.** Date logic lives in
  `packages/domain` and runs under five time zones in CI.

## Layout

| Path                     | What lives there                                               |
| ------------------------ | -------------------------------------------------------------- |
| `apps/web`               | The calendar app: one Foldkit program on Vite and Effect       |
| `apps/marketing`         | Static home, privacy and terms pages, prerendered to HTML      |
| `apps/edge`              | Cloudflare Worker: assets, OAuth proxy, rate limits, headers   |
| `apps/e2e`               | Playwright, axe and Lighthouse against the production build    |
| `packages/domain`        | Pure date and lane-layout logic. No React, no I/O              |
| `packages/google`        | Effect services for Google OAuth, Calendar and Tasks           |
| `packages/security`      | CSP and hardening headers, shared by the Worker and the build  |
| `packages/observability` | Sentry and PostHog wrappers with payload allowlists            |
| `packages/release`       | Version, channel and commit metadata for each build            |
| `infra`                  | Cloudflare resources as code (Alchemy); renders wrangler.jsonc |

Deeper docs live in `docs/`: `architecture.md`, `development.md`,
`security.md`, `observability.md`, `releasing.md`, `infrastructure.md`.

## Commands

Bun is the package manager and script runner; Vite, Vitest, wrangler and
Playwright run on Node. Always use `bun run <script>`: plain `bun build` and
`bun test` are Bun's own commands and skip this repo's scripts.

| Command                                 | Use it for                                         |
| --------------------------------------- | -------------------------------------------------- |
| `bun install`                           | Install; also installs the prek pre-commit hook    |
| `bun run dev`                           | Vite dev server on `http://127.0.0.1:3000`         |
| `bun run --cwd <dir> test:run`          | One package's unit tests                           |
| `bun run --cwd <dir> typecheck`         | One package's TypeScript and Effect diagnostics    |
| `bun run quality:static`                | oxlint, oxfmt, fallow and every typecheck          |
| `bun run test:coverage`                 | All unit tests with coverage thresholds            |
| `bun run test:tz:dates`                 | Domain date tests in five time zones               |
| `bun run build` then `test:e2e`         | Playwright and axe against the production build    |
| `bun run --cwd infra wrangler:generate` | Rewrite `apps/edge/wrangler.jsonc` from the config |

## Verifying a change

Run the narrowest check that covers what you touched: the package's
`test:run` and `typecheck`, and `bunx oxlint <files>`. Before opening a PR, run
`bun run quality:static` and `bun run test:coverage`. Run `test:tz:dates` when
you touch date code and `test:e2e` when you touch the year view, keyboard
handling or layout. Say which checks you ran and which you skipped.

## Things that cause real damage

1. **Deploying by hand.** Never run `wrangler deploy`, `wrangler versions
   deploy`, `wrangler secret put`, `alchemy deploy` or `scripts/deploy-web.sh`.
   Releases go through CI: previews per PR, nightly from `main`, stable from a
   release tag with a 10% canary.
2. **Editing generated or release-owned files.** `apps/edge/wrangler.jsonc` is
   generated from `infra/src/config.ts`. `CHANGELOG.md`, the root `version` and
   `.release-please-manifest.json` belong to release-please.
3. **Committing secrets.** `.env`, `.dev.vars` and anything under `.wrangler/`
   stay local.
4. **Killing processes by pattern.** Kill only a PID you started.

## Code conventions

- **Foldkit for the app.** `apps/web/src/foldkit` holds one program: a Schema
  Model and typed Messages (`model.ts`), a pure update (`app.ts`), pure HTML
  views, side effects as Commands (`commands.ts`), browser events as
  subscriptions (`subscriptions.ts`) and per-element DOM work as scoped Mount
  effects (`dialogs.ts`). The module map is in
  `docs/architecture.md`, under "Frontend composition".
- **Effect for I/O and concurrency.** Services are `Context.Service`s with live
  and test layers; failures are tagged errors. Commands run as scoped fibers.
  `LoadYear` is declared interruptible; load IDs and years reject stale
  completions. Starting another load does not currently cancel its
  predecessor.
- **Functional core.** oxlint enforces `functional/no-let`,
  `no-loop-statements`, `no-classes` and `immutable-data` in source files.
  Classes are allowed only where Effect requires them (tagged errors and
  service keys). Prefer `map`, `reduce` and spreads over mutation.
- **New lint suppressions say why**, after `--`:
  `// oxlint-disable-next-line functional/no-classes -- Effect tagged errors require a class.`
  Unused suppressions fail CI.
- **Boundaries.** `packages/domain` stays pure. In `apps/web`, update and views
  stay pure too: network, storage, DOM, focus and timers run through Commands,
  subscriptions, or scoped Mount effects.
- **Tests.** Coverage thresholds sit just under the current numbers and only go
  up. Use `TestClock` and fake timers, not real waits.

## Pull requests

- Titles follow Conventional Commits (`feat(web): …`, `fix(edge): …`,
  `build: …`); CI checks them and release-please builds the changelog from them.
- PRs are squash-merged. Fill in the template in
  `.github/pull_request_template.md`, including how you verified the change.
- Update `docs/` and the README when behavior, setup, security or operations
  change.
