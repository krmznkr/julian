import { afterEach, describe, expect, it, vi } from "vitest";
import { STORAGE_KEYS } from "@julian/google/token-store";
import { GoogleAuth } from "@julian/google/google-auth";
import * as TestEnv from "@julian/google/testing";
import { Effect } from "effect";
import { clearSessionHint, hasStoredGoogleSession, markSessionHint } from "@/lib/session";

describe("session", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
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

  it.each([
    { access: null, expiry: null, refresh: null, hint: false, auth: false },
    { access: "access", expiry: "1120000", refresh: null, hint: true, auth: true },
    { access: "access", expiry: "1060001", refresh: null, hint: true, auth: true },
    { access: "access", expiry: "1060000", refresh: null, hint: true, auth: false },
    { access: "access", expiry: "1000001", refresh: null, hint: true, auth: false },
    { access: "access", expiry: "1000000", refresh: null, hint: false, auth: false },
    { access: "access", expiry: "999999", refresh: null, hint: false, auth: false },
    { access: "access", expiry: null, refresh: null, hint: false, auth: false },
    { access: "access", expiry: "invalid", refresh: null, hint: false, auth: false },
    { access: "access", expiry: "Infinity", refresh: null, hint: false, auth: false },
    { access: null, expiry: "1120000", refresh: null, hint: false, auth: false },
    { access: "", expiry: "1120000", refresh: null, hint: true, auth: true },
    { access: "access", expiry: "1120000ms", refresh: null, hint: true, auth: true },
    { access: "access", expiry: "1120000.5", refresh: null, hint: true, auth: true },
    { access: "access", expiry: "999999", refresh: "refresh", hint: true, auth: true },
    { access: null, expiry: null, refresh: "refresh", hint: true, auth: true },
    { access: null, expiry: null, refresh: "", hint: true, auth: true },
  ])(
    "is a superset of real GoogleAuth semantics for $access/$expiry/$refresh",
    async ({ access, expiry, refresh, hint, auth }) => {
      vi.spyOn(Date, "now").mockReturnValue(1_000_000);
      const storage = Object.fromEntries(
        [
          [STORAGE_KEYS.accessToken, access],
          [STORAGE_KEYS.expiresAt, expiry],
          [STORAGE_KEYS.refreshToken, refresh],
        ].filter((entry): entry is [string, string] => entry[1] !== null),
      );
      Object.entries(storage).forEach(([key, value]) => localStorage.setItem(key, value));
      expect(hasStoredGoogleSession()).toBe(hint);
      const authenticated = await Effect.runPromise(
        Effect.gen(function* () {
          const env = yield* TestEnv.makeTestEnv({
            storage,
            responses: [
              TestEnv.jsonResponse({
                access_token: "renewed",
                expires_in: 3600,
                token_type: "Bearer",
              }),
            ],
          });
          return yield* Effect.flatMap(GoogleAuth, (service) => service.isAuthenticated).pipe(
            Effect.provide(env.layer),
          );
        }),
      );
      expect(authenticated).toBe(auth);
      expect(!authenticated || hint).toBe(true);
    },
  );

  it("recovers per key when only refresh-token storage is blocked", () => {
    const getItem = Storage.prototype.getItem;
    localStorage.setItem(STORAGE_KEYS.accessToken, "access");
    localStorage.setItem(STORAGE_KEYS.expiresAt, String(Date.now() + 120_000));
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key) {
      if (key === STORAGE_KEYS.refreshToken) throw new Error("blocked key");
      return getItem.call(this, key);
    });
    expect(hasStoredGoogleSession()).toBe(true);
  });

  it("handles an unavailable storage getter", () => {
    vi.spyOn(window, "localStorage", "get").mockImplementation(() => {
      throw new Error("unavailable");
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
