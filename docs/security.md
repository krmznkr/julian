# Security & hardening

This document describes how `julian.krmznkr.com` is protected, why each control
exists, and how to change it. Everything here is enforced **in code** and ships
through the normal `main` → CI → deploy pipeline; none of it depends on
Cloudflare dashboard toggles.

## Goals

Julian is a portfolio showcase linked from a resume/GitHub. It should be:

- **Reachable by a human with the link** with zero friction (no login wall).
- **Uninteresting to bots** — scrapers, SEO crawlers, and AI trainers kept out.
- **Invisible to search engines** — shared by direct link, not discoverable.
- **Cheap and safe** — stays inside Cloudflare's Free tier (no billing risk) and
  never leaks the Google OAuth client secret.

## Where it runs (account topology)

| Thing                         | Value                                                                     |
| ----------------------------- | ------------------------------------------------------------------------- |
| Active account (hosts Julian) | `93527c9983d1c08638cb9c1de99f0450` (`krmznkr@gmail.com`, Google SSO)      |
| Active zone                   | `krmznkr.com` — `08ca23de1d0f3b5923e975f0ece74251`, **Free Website** plan |
| Custom domain                 | `julian.krmznkr.com` (`workers_dev: false`, so no `*.workers.dev` URL)    |
| Deploy target in CI           | `deploy-stable.yml` / `nightly.yml` / `preview.yml` → account `93527…`    |

> A separate personal account (`c57b…`) holds an old `status: moved` copy of the
> `krmznkr.com` zone plus unrelated projects. That copy is inert. Any dashboard
> work must be done while logged into the **`93527…`** account.

**Billing:** the zone is on the Free plan with no billing configured. Cloudflare
Free never auto-charges; at worst, traffic is throttled at free limits. There is
no path to an unexpected bill.

## Request pipeline

`assets.run_worker_first = true` in `apps/edge/wrangler.jsonc` (rendered from
`infra/src/config.ts`) forces **every** request —
including static assets, which normally bypass the Worker — through
`apps/edge/src/pipeline.ts` (entry module: `apps/edge/src/index.ts`, which may
only have a default export), a single Effect pipeline where every rejection is a
tagged error rendered in one place (`toResponse`). Order of checks:

```
request
  → 1. bot filter        (bad/empty User-Agent → 403)
  → 2. site rate limit   (per IP, 240 / 60s → 429)
  → 3a. /api/oauth/*      → origin lock → oauth rate limit (12 / 60s) → Google
  → 3b. /version.json     → build metadata of this deploy
  → 3c. everything else   → ASSETS.fetch (SPA) + security headers; a missing
                            file (`/nope.js`, `/_headers`, `/.env`) requested
                            outside a navigation gets a real 404
```

## Controls

### 1. Bot filtering — `apps/edge/src/guards.ts`

`rejectBots()` returns `403` when the `User-Agent`:

- is **empty/missing** (real browsers always send one), or
- contains any entry in `BLOCKED_USER_AGENTS` (case-insensitive substring):
  aggressive SEO/scraper/AI bots (AhrefsBot, SemrushBot, MJ12bot, DotBot,
  PetalBot, Bytespider, DataForSeoBot, BLEXBot, …) and generic scripting clients
  (`python-requests`, `scrapy`, `go-http-client`, `curl/`, `wget/`, `java/`,
  `libwww-perl`) and scanners (`masscan`, `zgrab`, `nikto`, `sqlmap`).

Social link-preview bots (LinkedIn, Slack, Twitter/X, Facebook, WhatsApp) are
**intentionally not blocked** so sharing the link still renders a preview card.

**To tune:** edit the `BLOCKED_USER_AGENTS` array. Removing `curl/`/`wget/`
re-allows quick command-line checks.

### 2. Rate limiting — `infra/src/config.ts` + `apps/edge/src/guards.ts`

Native Workers rate limiting (no KV/DB, no billing), keyed by
`CF-Connecting-IP`:

| Binding           | Limit         | Scope                                           |
| ----------------- | ------------- | ----------------------------------------------- |
| `SITE_RATELIMIT`  | 240 req / 60s | every request (volumetric abuse cap)            |
| `OAUTH_RATELIMIT` | 12 req / 60s  | `/api/oauth/*` only (credential-exchange abuse) |

Production and nightly use separate namespace IDs (`1001`/`1002` and
`2001`/`2002`), so nightly traffic never spends production's budget.

Over-limit returns `429`. `period` must be `10` or `60`. Limits are best-effort
and enforced per Cloudflare location, which is fine for abuse mitigation.

**To tune:** change `RATE_LIMITS` in `infra/src/config.ts` and run
`pnpm --filter @julian/infra wrangler:generate`. The Worker reads the bindings by
name, so no code change is needed.

### 3. OAuth proxy lock-down — `apps/edge/src/oauth.ts`

`/api/oauth/token` and `/api/oauth/refresh` proxy the Google token exchange so
the client secret stays server-side. `checkRequest()` enforces:

- `POST` only (else `405`).
- `Origin` header must be one of `allowedOrigins(channel)`, else `403`:
  `https://julian.krmznkr.com` and `https://julian-nightly.krmznkr.com`, plus the
  `localhost`/`127.0.0.1` dev servers (Vite on 3000 or 5173, `wrangler dev` on 8787) only when
  `APP_CHANNEL` is `dev` (local `wrangler dev`). Stable, nightly and preview
  deploys never accept a local origin.
- The origin lock is **not authentication**: it stops cross-site pages in a
  browser, but any non-browser client can forge `Origin`. The rate limit and
  Google's own checks (PKCE, refresh-token validity) are what bound abuse.
- `Content-Length` ≤ `MAX_OAUTH_BODY_BYTES` (4 KB), else `413`.

**If you add a new deployed or dev origin,** add it to `DEPLOYED_ORIGINS` or
`LOCAL_ORIGINS` in `apps/edge/src/oauth.ts`.

### 4. Security headers — `packages/security/src/index.ts`

Applied to every response by the Worker (`withSecurityHeaders`). The build also
emits the same map as `dist/_headers`, a fallback in case `run_worker_first` is
ever disabled:

| Header                       | Value / purpose                                                   |
| ---------------------------- | ----------------------------------------------------------------- |
| `Content-Security-Policy`    | locks sources to self + Google Calendar API / sign-in (see below) |
| `Strict-Transport-Security`  | `max-age=15552000; includeSubDomains`                             |
| `X-Frame-Options`            | `DENY` (+ CSP `frame-ancestors 'none'`) — anti-clickjacking       |
| `X-Content-Type-Options`     | `nosniff`                                                         |
| `Referrer-Policy`            | `strict-origin-when-cross-origin`                                 |
| `Permissions-Policy`         | disables camera/mic/geolocation/FLoC                              |
| `Cross-Origin-Opener-Policy` | `same-origin`                                                     |
| `X-Robots-Tag`               | `noindex, nofollow` (see de-indexing)                             |

**CSP breakdown** (defined once in `packages/security/src/index.ts`):

```
default-src 'self'
script-src 'self'                         # Vite output + /bootstrap.js, all same-origin
style-src 'self' 'unsafe-inline'          # Tailwind/Radix inject inline styles
img-src 'self' data:                      # no remote images
connect-src 'self' https://www.googleapis.com   # Calendar API + our /api/oauth
form-action 'self' https://accounts.google.com  # Google sign-in navigation
frame-ancestors 'none'; base-uri 'self'; object-src 'none'
upgrade-insecure-requests
```

> ⚠️ **If you add a new external API call from the browser**, add its origin to
> `connect-src` in `packages/security/src/index.ts`, or the request
> will be blocked by CSP.

### 5. De-indexing (kept out of search) — `index.html` + headers + Cloudflare

Three layers:

1. `X-Robots-Tag: noindex, nofollow` on every response (authoritative signal).
2. `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">` in
   `index.html`.
3. Cloudflare's **managed `robots.txt`** (zone feature, declared in
   `infra/alchemy.run.ts`) `Disallow`s the
   major AI crawlers (GPTBot, ClaudeBot, CCBot, Bytespider, Google-Extended, …)
   while allowing search crawl — which is required so crawlers actually _see_ the
   `noindex` and drop the page from the index.

There is intentionally **no** custom `apps/web/public/robots.txt`: a blanket `Disallow: /`
would stop crawlers from ever reading the `noindex` header (leaving bare URLs
indexable) and conflicted with the managed file.

Link previews are separate from search. The landing page, `/demo` and the app
shell carry Open Graph and `twitter:card` tags with an absolute
`/og-image.png` URL on the build's channel origin (`packages/release/src/share.ts`),
so a link pasted into LinkedIn, Slack, Discord or iMessage shows a title, a
description and an image. Those bots are not on the blocked list, and the
`noindex` signals above stay in place. There is no sitemap.

### 6. Secret handling — `README.md`, `.github/actions/build-web`, `scripts/deploy-web.sh`

- `VITE_GOOGLE_CLIENT_ID` is **public** by design (OAuth client identifier).
- `GOOGLE_CLIENT_SECRET` exists **only** in the Cloudflare Worker secret store
  and 1Password — never in `.env`, never with a `VITE_` prefix.
- Every CI deploy path and `scripts/deploy-web.sh` **hard-fail** if a
  `GOCSPX-…` client secret is ever found in `dist/`.

Set/rotate it with:

```bash
pnpm --filter @julian/edge exec wrangler secret put GOOGLE_CLIENT_SECRET
```

## Deploying

Production ships from release tags, not from pushes to `main`; see
[`releasing.md`](releasing.md) for the preview, nightly and stable channels.
Each one builds through `.github/actions/build-web`, which verifies no secret
leaked into `dist/` before Wrangler runs against account `93527…`.

Manual break-glass deploy (needs a Workers-scoped token for account `93527…`):

```bash
./scripts/deploy-web.sh
```

## Verifying protections (production smoke tests)

```bash
# Bots blocked (403), real browser allowed (200)
curl -s -o /dev/null -w "%{http_code}\n" -A "AhrefsBot/7.0"      https://julian.krmznkr.com/
curl -s -o /dev/null -w "%{http_code}\n" -A "python-requests/2"  https://julian.krmznkr.com/
curl -s -o /dev/null -w "%{http_code}\n" -A ""                   https://julian.krmznkr.com/
curl -s -o /dev/null -w "%{http_code}\n" -A "Mozilla/5.0 Chrome/126.0" https://julian.krmznkr.com/

# Security headers present
curl -sI -A "Mozilla/5.0 Chrome/126.0" https://julian.krmznkr.com/ \
  | grep -iE "content-security-policy|strict-transport|x-frame|x-robots-tag"

# OAuth proxy: foreign / no origin -> 403
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://julian.krmznkr.com/api/oauth/token \
  -H "Origin: https://evil.example" -H "Content-Type: application/json" -d '{}'

# OAuth rate limit: a burst of >12/60s -> 429
for i in $(seq 1 15); do
  curl -s -o /dev/null -w "%{http_code}\n" -X POST https://julian.krmznkr.com/api/oauth/token \
    -A "Mozilla/5.0 Chrome/126.0" -H "Origin: https://julian.krmznkr.com" \
    -H "Content-Type: application/json" -d '{}'
done
```

## Trade-offs & known follow-ups

- **`run_worker_first: true`** means every request (including assets) is a Worker
  invocation. At showcase traffic this is negligible against the 100k/day free
  ceiling, and blocking bots early is cheap.
- **CSP vs. Google sign-in:** the production flow was exercised end to end on
  2026-07-15 without a CSP or redirect mismatch. Any new browser-side origin
  must still be added to `packages/security/src/index.ts`.
- **Managed robots.txt** currently signals `search=yes`. Indexing is still
  prevented by the `noindex` header; flip the content signal to `search=no` from
  the dashboard if you want the extra signal.
- **Rate limits are per-Cloudflare-location** (best-effort), suitable for abuse
  mitigation, not hard quotas.
- **Stronger option (not enabled):** Cloudflare Access (free ≤50 users) would put
  an email-OTP wall in front of the site — maximum privacy, but adds friction for
  recruiters. Deliberately avoided for this showcase.

## Open items

The actionable checklist of remaining tasks, post-change verification steps, and
gotchas lives in [`follow-ups.md`](follow-ups.md).
