// A synchronous read of the stored Google session.
//
// `isAuthenticated()` is async because it may refresh the token over the
// network. Route guards need an answer before first paint, and "is there a
// credential on this device at all" is enough to decide whether to show the
// landing page — the year view re-checks properly once it mounts.
import { STORAGE_KEYS } from "@julian/google/token-store";
import { sessionHintClearCookie, sessionHintSetCookie } from "@julian/security/session-hint";

export function hasStoredGoogleSession(): boolean {
  try {
    if (localStorage.getItem(STORAGE_KEYS.refreshToken)) return true;

    const accessToken = localStorage.getItem(STORAGE_KEYS.accessToken);
    const expiresAt = Number(localStorage.getItem(STORAGE_KEYS.expiresAt));
    return Boolean(accessToken) && Number.isFinite(expiresAt) && Date.now() < expiresAt;
  } catch {
    // Storage can be blocked entirely (Safari private mode, hardened profiles).
    return false;
  }
}

// The hint cookie lets the edge send a returning visitor from `/` to their
// year. It carries no credential (see @julian/security/session-hint).
export function markSessionHint(): void {
  writeCookie(sessionHintSetCookie());
}

export function clearSessionHint(): void {
  writeCookie(sessionHintClearCookie());
}

function writeCookie(assignment: string): void {
  // `document.cookie` is a setter, not a field: assigning adds one cookie.
  // eslint-disable-next-line functional/immutable-data
  document.cookie = assignment;
}
