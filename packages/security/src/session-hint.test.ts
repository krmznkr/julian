import { describe, expect, it } from "vitest";
import {
  SESSION_HINT_COOKIE,
  hasSessionHint,
  sessionHintClearCookie,
  sessionHintSetCookie,
} from "./session-hint";

describe("session hint cookie", () => {
  it("is a year-long, site-wide, Lax, Secure flag with no token in it", () => {
    expect(sessionHintSetCookie()).toBe(
      `${SESSION_HINT_COOKIE}=1; Max-Age=31536000; Path=/; SameSite=Lax; Secure`,
    );
  });

  it("clears with an immediate expiry on the same path", () => {
    expect(sessionHintClearCookie()).toBe(
      `${SESSION_HINT_COOKIE}=; Max-Age=0; Path=/; SameSite=Lax; Secure`,
    );
  });

  it.each([
    ["julian_session=1", true],
    ["theme=dark; julian_session=1", true],
    ["julian_session=", false],
    ["other_julian_session=1", false],
    ["julian_sessionx=1", false],
    ["", false],
    [null, false],
    [undefined, false],
  ])("reads %j as %s", (header, expected) => {
    expect(hasSessionHint(header)).toBe(expected);
  });
});
