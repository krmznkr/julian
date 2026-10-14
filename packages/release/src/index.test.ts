import { describe, expect, it } from "vitest";
import { appVersion, buildInfo, buildInputFromEnv, nextMinor, parseChannel } from "./index";

const date = new Date("2026-10-15T03:00:00Z");
const commit = "0123456789abcdef";

describe("appVersion", () => {
  it("uses the release version as-is for stable", () => {
    expect(appVersion({ baseVersion: "1.4.0", channel: "stable", commit, date })).toBe("1.4.0");
  });

  it("stamps nightlies with the next minor, UTC date and commit", () => {
    expect(appVersion({ baseVersion: "1.4.0", channel: "nightly", commit, date })).toBe(
      "1.5.0-nightly.20261015+0123456",
    );
  });

  it("names previews after the pull request", () => {
    expect(
      appVersion({ baseVersion: "0.1.5", channel: "preview", commit, date, prNumber: 42 }),
    ).toBe("0.2.0-pr.42+0123456");
  });

  it("requires a pull request number for previews", () => {
    expect(() => appVersion({ baseVersion: "0.1.5", channel: "preview", commit, date })).toThrow(
      /pull request/,
    );
  });

  it("marks local builds as dev", () => {
    expect(appVersion({ baseVersion: "0.1.5", channel: "dev", commit: "", date })).toBe(
      "0.1.5-dev+unknown",
    );
  });
});

describe("helpers", () => {
  it("bumps the minor and resets the patch", () => {
    expect(nextMinor("0.1.5")).toBe("0.2.0");
    expect(() => nextMinor("1.0.0-rc.1")).toThrow(/Not a release version/);
  });

  it("falls back to dev for unknown channels", () => {
    expect(parseChannel("nightly")).toBe("nightly");
    expect(parseChannel("beta")).toBe("dev");
    expect(parseChannel(undefined)).toBe("dev");
  });

  it("reads CI inputs from the environment", () => {
    const fallback = { baseVersion: "0.1.5", commit: "fallbacksha", date };
    expect(buildInputFromEnv({}, fallback)).toEqual({ ...fallback, channel: "dev" });
    expect(
      buildInputFromEnv(
        { APP_CHANNEL: "preview", APP_PR_NUMBER: "7", APP_COMMIT: "abcdef0123" },
        fallback,
      ),
    ).toEqual({ ...fallback, channel: "preview", commit: "abcdef0123", prNumber: 7 });
    expect(buildInputFromEnv({ APP_PR_NUMBER: "nope" }, fallback)).not.toHaveProperty("prNumber");
  });

  it("bundles version, channel and short commit", () => {
    expect(buildInfo({ baseVersion: "0.1.5", channel: "stable", commit, date })).toEqual({
      version: "0.1.5",
      channel: "stable",
      commit: "0123456",
    });
  });
});
