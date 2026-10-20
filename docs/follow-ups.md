# Follow-ups & operational notes

Running checklist of things left to do, things to verify, and things to remember
for `julian.krmznkr.com`. Design details live in [`security.md`](security.md).

## Open action items

- [x] **Authorize the nightly OAuth redirect.** Verified 2026-10-19 in Google
      Cloud project `krmznkr-julian`: the nightly JavaScript origin and
      `/auth/callback` redirect are saved in the production OAuth client.
      Google 2-step verification is enabled on the public account.
- [x] **Authorize the local `127.0.0.1` callbacks.** Both `:3000` and `:8787`
      origins and `/auth/callback` redirects were saved and verified 2026-10-19.
- [x] **Create environment and preview Cloudflare tokens.** Verified 2026-10-19:
      `CLOUDFLARE_API_TOKEN` exists in the `production` and `nightly`
      environments; least-privilege `CLOUDFLARE_PREVIEW_TOKEN` is set.
- [x] **Remove the repository Cloudflare deploy token after proof.** Done
      2026-10-20. Release run `39359783565` deployed `v0.3.0` (`ce6890d`) with
      the `production` environment `CLOUDFLARE_API_TOKEN`: smoke check passed
      on attempt 1, 100% promotion at 02:37:07Z, no rollback. The
      repository-level copy was then deleted, and `gh secret list` no longer
      shows it. The `production` and `nightly` environment tokens stay.
- [ ] **Verify a non-Dependabot PR preview URL.** The upload half is proven:
      Preview uploaded with `CLOUDFLARE_PREVIEW_TOKEN` for #53 and #56, and
      most recently for #54 as version `152b5f69-43d9-4e05-8b83-2d1349ed9d7b`.
      No preview URL was reported or opened yet. Still to do: confirm a preview
      URL loads. Dependabot cannot read this secret.
- [ ] **Confirm Sentry ingestion for the current release.** For `v0.3.0`
      (`ce6890d`), no event or trace had been seen in Sentry as of 2026-10-20
      02:41:40Z. Confirm one arrives tagged with the release (see
      [`observability.md`](observability.md#verification)).
- [x] **Check the nightly custom domain.** `julian-nightly.krmznkr.com`
      resolves and serves the nightly channel, verified 2026-10-19.
- [x] **Set the nightly Worker secret.** `nightly.yml` now copies the
      `GOOGLE_CLIENT_SECRET` GitHub secret into the nightly Worker on every run.
- [x] **Tag the baseline release.** `v0.1.5` marks the release-please baseline.
- [x] **Create the `production` and `nightly` GitHub environments.** Both
      environments and their deploy secrets were verified 2026-10-19.
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
- [x] **First stable release with telemetry (`v0.3.0`)**, checked 2026-10-20.
      Main CI run `39359783357` passed on the release commit (ci, e2e with 40
      tests, Lighthouse). Sentry received 22 private source-map files for
      `ce6890d`, and all 12 public JS `.map` URLs return 404. PostHog ingested
      a production `/demo` `$pageview` at 02:40:07Z under the `app=julian` and
      `environment=production` filters. The URL was scrubbed. Person,
      GeoIP and IP fields were empty, and no cookies or storage were written.
      Sentry showed 0 unresolved issues over 24h; that does not prove
      ingestion (open item above).

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
- **New deployed or dev origin for OAuth?** Add it to `DEPLOYED_ORIGINS` or
  `LOCAL_ORIGINS` in `apps/edge/src/oauth.ts` (local origins only work on the
  `dev` channel).
- **Dashboard work** must be done while logged into account **`93527…`**
  (`krmznkr@gmail.com`, Google SSO) — not the personal `c57b…` account.
- **CSP has one source**, `packages/security/src/index.ts`; the build emits
  `dist/_headers` from it.
- **Rotate the secret** with `pnpm --filter @julian/edge exec wrangler secret put GOOGLE_CLIENT_SECRET`
  (Worker secret store only — never in `.env`, never `VITE_`-prefixed).

## Tuning knobs

- **Bot blocklist:** `BLOCKED_USER_AGENTS` in `apps/edge/src/guards.ts`.
- **Rate limits:** `SITE_RATELIMIT` (240/60s) and `OAUTH_RATELIMIT` (12/60s),
  with separate namespaces for nightly, in `infra/src/config.ts` (`period` must be `10` or `60`); regenerate
  `apps/edge/wrangler.jsonc` with `pnpm --filter @julian/infra wrangler:generate`.
- **OAuth body cap:** `MAX_OAUTH_BODY_BYTES` in `apps/edge/src/oauth.ts`.

## Deferred / not doing (by decision)

- **Cloudflare Access login wall** (free ≤50 users): maximum privacy but adds
  email-OTP friction for recruiters. Deliberately avoided for a showcase; revisit
  only if abuse persists despite the in-Worker controls.
