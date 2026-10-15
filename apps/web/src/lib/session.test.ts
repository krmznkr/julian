import { afterEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@julian/google/token-store";
import { clearSessionHint, hasStoredGoogleSession, markSessionHint } from "@/lib/session";

describe("session", () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("treats a refresh token or an unexpired access token as a stored session", () => {
    expect(hasStoredGoogleSession()).toBe(false);
    localStorage.setItem(STORAGE_KEYS.accessToken, "access");
    localStorage.setItem(STORAGE_KEYS.expiresAt, String(Date.now() + 60_000));
    expect(hasStoredGoogleSession()).toBe(true);
    localStorage.setItem(STORAGE_KEYS.expiresAt, String(Date.now() - 1));
    expect(hasStoredGoogleSession()).toBe(false);
    localStorage.setItem(STORAGE_KEYS.refreshToken, "refresh");
    expect(hasStoredGoogleSession()).toBe(true);
  });

  it("reports no session when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(hasStoredGoogleSession()).toBe(false);
  });

  it("writes and clears the session hint cookie", () => {
    const writes: string[] = [];
    vi.spyOn(document, "cookie", "set").mockImplementation((value: string) => {
      writes.push(value);
    });
    markSessionHint();
    clearSessionHint();
    expect(writes[0]).toMatch(
      /^julian_session=1; Max-Age=31536000; Path=\/; SameSite=Lax; Secure$/,
    );
    expect(writes[1]).toMatch(/^julian_session=; Max-Age=0;/);
  });
});
