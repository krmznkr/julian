// PR previews and the sign-in relay that lets them use Google.
//
// Each PR uploads a Version URL of the production Worker at
// `https://pr-<N>-julian.<account subdomain>.workers.dev`. Google only accepts
// redirect URIs registered in advance and has no wildcards, so a preview asks
// Google to return to the production callback instead, naming itself in the
// OAuth `state`. The production edge then sends the browser, code and all, on
// to the preview's own `/auth/callback`, where the PKCE verifier lives.
//
// Only origins matching this exact shape are ever relayed to or trusted: the
// account's workers.dev subdomain can only be published to by this account.

/** The Cloudflare account's workers.dev subdomain. */
const ACCOUNT_SUBDOMAIN = "julian-93527c9983d1";

const PREVIEW_ORIGIN = new RegExp(
  `^https://pr-[1-9][0-9]{0,5}-julian\\.${ACCOUNT_SUBDOMAIN}\\.workers\\.dev$`,
);

/** The registered callback that previews borrow. */
export const PREVIEW_SIGN_IN_REDIRECT_URI = "https://julian.krmznkr.com/auth/callback";

export const isPreviewOrigin = (origin: string): boolean => PREVIEW_ORIGIN.test(origin);

/**
 * Where a callback request should be forwarded, or null when it is an ordinary
 * sign-in. `state` is the OAuth state Google returned, which names the preview
 * that started the sign-in; `search` is the callback's query, passed on whole.
 */
export const previewCallbackTarget = (callback: {
  readonly origin: string;
  readonly state: string | null;
  readonly search: string;
}): string | null => {
  const { origin, state, search } = callback;
  if (state === null || !isPreviewOrigin(state) || state === origin) return null;
  return `${state}/auth/callback${search}`;
};
