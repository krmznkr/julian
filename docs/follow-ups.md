# Follow-ups & operational notes

Running checklist of things left to do, things to verify, and things to remember
for `julian.krmznkr.com`. Design details live in [`security.md`](security.md).

## Open action items

- [ ] **Authorize the nightly OAuth redirect.** In Google Cloud project
      `krmznkr-julian`, add `https://julian-nightly.krmznkr.com/auth/callback`
      to the OAuth client's redirect URIs and
      `https://julian-nightly.krmznkr.com` to its JavaScript origins. The
      Worker already allows the origin.
- [ ] **Set the nightly Worker secret** once, before the first nightly:
      `pnpm --filter @julian/edge exec wrangler secret put GOOGLE_CLIENT_SECRET --env nightly`.
- [ ] **Tag the baseline release.** Push `v0.1.5` on the current `main` so
      release-please starts its changelog there instead of the whole history.
- [ ] **Create the `production` and `nightly` GitHub environments** (optional
      protection rules) used by the deploy workflows.
- [ ] **Turn on Cloudflare as code.** Widen the API token, bootstrap the Alchemy
      state store, review the adoption plan, apply once, then set the
      `ALCHEMY_ENABLED` repository variable. Steps in
      [`infrastructure.md`](infrastructure.md#one-time-owner-steps).

- [ ] **(Optional) Set managed robots.txt `Content-Signal: search=no`.** Indexing
      is already prevented by the `noindex` header; this only adds an extra
      signal. Alchemy's bot management resource does not expose it yet, so it
      stays a dashboard change. Requires dashboard access to account `93527…`.
- [ ] **(Optional) Clean up 1Password.** The `Cloudflare` login item holds a
      revoked `homelab-access-home-issue2` API token — delete it to avoid
      confusion.
- [ ] **(Optional) Remove the stale zone.** Account `c57b…` still lists
      `krmznkr.com` as `status: moved`. Harmless, but can be deleted for tidiness.

## Completed verification

- [x] **Google sign-in against the CSP** — verified end to end on 2026-07-15
      with the production client: account chooser, expected unverified-app
      warning, consent, callback, and calendar rendering all completed without
      `redirect_uri_mismatch` or a CSP block.

## Verify after any change

- [ ] `pnpm typecheck && pnpm test:run && pnpm build` pass locally.
- [ ] CI and Preview workflows are green on the PR; Deploy stable is green
      after the release PR merges.
- [ ] Production smoke tests still pass (see "Verifying protections" in
      [`security.md`](security.md)): bots → 403, browser → 200, headers present,
      foreign-origin OAuth → 403, OAuth burst → 429.

## Remember (gotchas)

- **New browser-side external API call?** Add its origin to `connect-src` in
  `packages/security/src/index.ts`, or CSP will block it.
- **New dev/preview origin for OAuth?** Add it to `ALLOWED_ORIGINS` in
  `apps/edge/src/oauth.ts`.
- **Dashboard work** must be done while logged into account **`93527…`**
  (`krmznkr@gmail.com`, Google SSO) — not the personal `c57b…` account.
- **CSP has one source**, `packages/security/src/index.ts`; the build emits
  `dist/_headers` from it.
- **Rotate the secret** with `pnpm --filter @julian/edge exec wrangler secret put GOOGLE_CLIENT_SECRET`
  (Worker secret store only — never in `.env`, never `VITE_`-prefixed).

## Tuning knobs

- **Bot blocklist:** `BLOCKED_USER_AGENTS` in `apps/edge/src/guards.ts`.
- **Rate limits:** `SITE_RATELIMIT` (240/60s) and `OAUTH_RATELIMIT` (12/60s) in
  `infra/src/config.ts` (`period` must be `10` or `60`); regenerate
  `apps/edge/wrangler.jsonc` with `pnpm --filter @julian/infra wrangler:generate`.
- **OAuth body cap:** `MAX_OAUTH_BODY_BYTES` in `apps/edge/src/oauth.ts`.

## Deferred / not doing (by decision)

- **Cloudflare Access login wall** (free ≤50 users): maximum privacy but adds
  email-OTP friction for recruiters. Deliberately avoided for a showcase; revisit
  only if abuse persists despite the in-Worker controls.
