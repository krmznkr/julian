// The session hint: a cookie that says "this browser has signed in before".
//
// It carries no token and grants nothing. Google tokens stay in the browser's
// local storage; the hint only lets the edge Worker send a returning visitor
// from `/` straight to their year instead of the marketing page. The web app
// sets it after sign-in and clears it on logout.

export const SESSION_HINT_COOKIE = "julian_session";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

const ATTRIBUTES = "Path=/; SameSite=Lax; Secure";

/** `document.cookie` assignment that sets the hint for about a year. */
export const sessionHintSetCookie = (): string =>
  `${SESSION_HINT_COOKIE}=1; Max-Age=${ONE_YEAR_SECONDS}; ${ATTRIBUTES}`;

/** `document.cookie` assignment that removes the hint. */
export const sessionHintClearCookie = (): string =>
  `${SESSION_HINT_COOKIE}=; Max-Age=0; ${ATTRIBUTES}`;

/** True when a `Cookie` header (or `document.cookie`) contains a non-empty hint. */
export const hasSessionHint = (cookieHeader: string | null | undefined): boolean =>
  (cookieHeader ?? "")
    .split(";")
    .map((pair) => pair.trim())
    .some(
      (pair) =>
        pair.startsWith(`${SESSION_HINT_COOKIE}=`) && pair.length > SESSION_HINT_COOKIE.length + 1,
    );
