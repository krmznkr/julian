// A synchronous read of the stored Google session.
//
// `isAuthenticated()` is async because it may refresh the token over the
// network. Route guards need an answer before first paint, and "is there a
// credential on this device at all" is enough to decide whether to show the
// landing page — the year view re-checks properly once it mounts.
import { STORAGE_KEYS } from "@julian/google/token-store";
import { sessionHintClearCookie, sessionHintSetCookie } from "@julian/security/session-hint";

export function hasStoredGoogleSession(): boolean {
  // Match KeyValueStore's per-key error recovery and presence semantics,
  // including empty strings. A refresh credential still needs the full check.
  if (readStoredCredential(STORAGE_KEYS.refreshToken) !== null) return true;

  const accessToken = readStoredCredential(STORAGE_KEYS.accessToken);
  const expiresAt = Number.parseInt(readStoredCredential(STORAGE_KEYS.expiresAt) ?? "", 10);
  // TokenStore uses parseInt too, but refreshes 60s early. Omitting that skew
  // deliberately makes this a superset, never a substitute for authentication.
  return accessToken !== null && Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

function readStoredCredential(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage can be blocked entirely (Safari private mode, hardened profiles).
    return null;
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
