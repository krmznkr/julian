# Follow-ups & operational notes

Running checklist of things left to do, things to verify, and things to remember
for `julian.krmznkr.com`. Design details live in [`security.md`](security.md).

## Open action items

- [ ] **Verify Google sign-in against the CSP.** The hardened CSP hasn't been
      exercised against a live login. Sign in once at
      https://julian.krmznkr.com. If the flow breaks, it's a `connect-src` /
      `form-action` entry — add the blocked origin in **both**
      `worker/index.ts` (`CONTENT_SECURITY_POLICY`) and `public/_headers`, then
      redeploy.
- [ ] **(Optional) Set managed robots.txt `Content-Signal: search=no`.** Indexing
      is already prevented by the `noindex` header; this only adds an extra
      signal. Requires dashboard access to account `93527…`.
- [ ] **(Optional) Clean up 1Password.** The `Cloudflare` login item holds a
      revoked `homelab-access-home-issue2` API token — delete it to avoid
      confusion.
- [ ] **(Optional) Remove the stale zone.** Account `c57b…` still lists
      `krmznkr.com` as `status: moved`. Harmless, but can be deleted for tidiness.

## Verify after any change

- [ ] `pnpm typecheck && pnpm test:run && pnpm build` pass locally.
- [ ] CI + Deploy workflows are green on the pushed commit.
- [ ] Production smoke tests still pass (see "Verifying protections" in
      [`security.md`](security.md)): bots → 403, browser → 200, headers present,
      foreign-origin OAuth → 403, OAuth burst → 429.

## Remember (gotchas)

- **New browser-side external API call?** Add its origin to `connect-src` in
  **both** `worker/index.ts` and `public/_headers`, or CSP will block it.
- **New dev/preview origin for OAuth?** Add it to `ALLOWED_ORIGINS` in
  `worker/index.ts`.
- **Dashboard work** must be done while logged into account **`93527…`**
  (`krmznkr@gmail.com`, Google SSO) — not the personal `c57b…` account.
- **CSP is duplicated** in `worker/index.ts` and `public/_headers`; keep them in
  sync.
- **Rotate the secret** with `pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET`
  (Worker secret store only — never in `.env`, never `VITE_`-prefixed).

## Tuning knobs

- **Bot blocklist:** `BLOCKED_USER_AGENTS` in `worker/index.ts`.
- **Rate limits:** `SITE_RATELIMIT` (240/60s) and `OAUTH_RATELIMIT` (12/60s) in
  `wrangler.jsonc` (`period` must be `10` or `60`).
- **OAuth body cap:** `MAX_OAUTH_BODY_BYTES` in `worker/index.ts`.

## Deferred / not doing (by decision)

- **Cloudflare Access login wall** (free ≤50 users): maximum privacy but adds
  email-OTP friction for recruiters. Deliberately avoided for a showcase; revisit
  only if abuse persists despite the in-Worker controls.
