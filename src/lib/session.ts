// A synchronous read of the stored Google session.
//
// `isAuthenticated()` is async because it may refresh the token over the
// network. Route guards need an answer before first paint, and "is there a
// credential on this device at all" is enough to decide whether to show the
// landing page — the year view re-checks properly once it mounts.
import { STORAGE_KEYS } from "@/lib/effect/token-store";

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
