# Roadmap

Goal: make Julian a showcase of product, infrastructure, and code quality in one
repository, with Effect as the backbone everywhere.

## Where we are

- Single Vite app (`src/`) plus a Cloudflare Worker (`worker/`).
- Effect `4.0.4` (LTS to Sep 2029) is used
  only in `src/lib/effect/*` (Google HTTP via `effect/http`, auth,
  token store, schemas, errors; services already use `Context.Service`). React hooks, `async-task.ts`, `session.ts`,
  the landing demo, and the whole Worker still use raw `async`/`Promise`.
- Domain logic already lives in `src/domain/` and is well tested.
- Coverage: 55% statements, 41% branches. No thresholds, no E2E.
- CSP duplicated in `worker/index.ts` and `public/_headers`.
- Cloudflare config partly in `wrangler.jsonc`, partly manual dashboard work.

## Target layout

```
julian/
├── apps/
│   ├── web/          # the calendar: /2026, /2026/03, /demo/2026, /auth/callback
│   ├── marketing/    # /, /home, /privacy, /terms
│   └── edge/         # Cloudflare Worker: routing, OAuth proxy, headers, rate limits
├── packages/
│   ├── domain/       # pure year-grid, dates, events, layout (no React, no Effect services)
│   ├── schema/       # Effect Schema: Google payloads, app models, branded IDs
│   ├── google/       # Effect services: GoogleAuth, CalendarApi, TasksApi, HttpClient layers
│   ├── security/     # single-source CSP + headers, used by edge and marketing builds
│   ├── ui/           # shared components, theme, tokens
│   └── config/       # tsconfig, oxlint, oxfmt, vitest presets
├── infra/            # Alchemy (Effect-native IaC): Worker, assets, DNS, rate limits, secrets
└── docs/
```

### URL scheme (served by one Worker, free, same domain)

| Path | App |
| --- | --- |
| `/` | marketing; redirects to `/{currentYear}` when the `julian_session` hint cookie is set |
| `/home`, `/privacy`, `/terms` | marketing |
| `/{yyyy}`, `/{yyyy}/{mm}`, `/u/{n}/{yyyy}` | web |
| `/demo/{yyyy}` | web, sample data |
| `/auth/*`, `/oauth/*` | edge (OAuth proxy) then web |

The hint cookie carries no token; Google tokens stay in the browser.

## Effect everywhere

| Area | Today | With Effect |
| --- | --- | --- |
| Google APIs | partial Effect | `CalendarApi`, `TasksApi`, `GoogleAuth` as `Context.Service`s with live and test `Layer`s; `HttpClient` from `effect/http` |
| Errors | mixed classes / strings | `Schema.TaggedError` per failure (`Unauthorized`, `RateLimited`, `NotFound`, `Network`), exhaustive `catchTags` |
| Data validation | partial schemas | every Google response and storage read decoded with `Schema`; branded `CalendarId`, `EventId` |
| Retries / auth refresh | ad hoc | `Schedule` (exponential + jitter, respects `Retry-After`); refresh as a single-flight `Effect.cached` |
| Storage | key-value store, token store | `KeyValueStore` service with `localStorage` and in-memory layers |
| React | `useEffect` + `async-task.ts` | one `ManagedRuntime` in context; small `useEffectQuery` / `useEffectMutation` hooks; fibers interrupted on unmount |
| Demo player | timers + promises | `Effect.gen` script with `Effect.sleep`, `Fiber` for play/pause, `TestClock` in tests |
| Worker | raw `async fetch` | `HttpRouter` from `effect/http` behind a fetch handler, middleware for headers, rate limit, origin lock; `Config` for secrets; `Redacted` for the client secret |
| Config | `import.meta.env` scattered | `Config` service, validated once at startup |
| Observability | none | `Effect.withSpan` on API calls; optional OTLP export from the Worker |
| Tests | Vitest | `@effect/vitest` `it.effect`, test layers, `TestClock`; no network mocks |
| Infra | `wrangler.jsonc` + dashboard clicks | Alchemy resources in TypeScript, same Effect model; `wrangler.jsonc` deleted |
| Tooling | — | Effect LSP (`@effect/language-service`) diagnostics in typecheck/CI |

Note: modules tagged `@stability unstable` may change in minor releases; pin
exact versions and let Dependabot propose upgrades.

Rule: `packages/domain` stays plain TypeScript (pure functions, easy to read).
Everything with I/O, time, or failure goes through Effect.

## Phases

Each phase is one or more PRs, merged green, deployable on its own.

### Phase 0: Baseline (small, now)
- [x] Upgrade `effect` + `@effect/vitest` from `4.0.0-beta.102` to `4.0.4`
      using the [migration guide](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md).
- [ ] Add Effect LSP diagnostics to `pnpm typecheck`.
- [ ] Coverage reported in CI; thresholds at current levels so they can only rise.
- [ ] README hero: screenshot/GIF, live link, badges, "why it's interesting".
- [ ] Single-source CSP with a test (later moves to `packages/security`).

### Phase 1: Workspace
- [ ] `pnpm-workspace.yaml`, Turborepo, `packages/config`.
- [ ] Move current app to `apps/web`, Worker to `apps/edge`, no behavior change.

### Phase 2: Packages
- [ ] `packages/domain` from `src/domain` + year-grid helpers.
- [ ] `packages/schema` and `packages/google` from `src/lib/effect` + `google-calendar.ts`.
- [ ] `packages/security`; delete `public/_headers` duplication.

### Phase 3: Effect everywhere
- [ ] Google services as Tags + Layers; tagged errors; retry `Schedule`.
- [ ] React runtime + query/mutation hooks; delete `async-task.ts`.
- [ ] `session.ts`, storage, config as services.
- [ ] Worker rewritten on `@effect/platform` HttpRouter with middleware.
- [ ] Demo player as an Effect script tested with `TestClock`.

### Phase 4: Product
- [ ] Year-based URLs (`/2026`, `/2026/03`, `/demo/2026`), redirect via hint cookie.
- [ ] `apps/marketing` split out; `/privacy`, `/terms`.
- [ ] Calendar toggles + search/filter.
- [ ] One standout feature: drag to move events, or print/PDF export.
- [ ] Mobile/touch layout; a11y pass on the grid.

### Phase 5: Infra as code
- [ ] `infra/` with [Alchemy](https://alchemy.run): Worker + assets, rate limit
      bindings, secret, DNS, robots `Content-Signal`. Cleans up the manual items
      in `follow-ups.md`. Alchemy 2 is still beta; fall back to OpenTofu if it
      blocks.
- [ ] Preview deploy per PR, production deploy on main.

### Phase 6: Quality signals
- [ ] Playwright E2E on `/demo/2026` (keyboard nav, event create) in CI.
- [ ] Coverage ≥ 80% statements, ≥ 70% branches, per package.
- [ ] Lighthouse + axe in CI; scores in README.
- [ ] Architecture diagram in README; per-package READMEs.

## Order rationale

Baseline first (cheap, visible). Workspace before packages, so moves are
mechanical. Effect migration before new features, so features are written once,
the right way. Infra last because it needs Cloudflare API access and changes no
user-facing behavior.
