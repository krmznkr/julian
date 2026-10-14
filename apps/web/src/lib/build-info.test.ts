import { describe, expect, it } from "vitest";
import { BUILD_INFO, buildLabel } from "./build-info";

describe("build info", () => {
  it("is injected at build time", () => {
    expect(BUILD_INFO.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(BUILD_INFO.commit).not.toBe("");
  });

  it("only names the channel outside stable", () => {
    expect(buildLabel({ version: "1.4.0", channel: "stable", commit: "abc1234" })).toBe("v1.4.0");
    expect(
      buildLabel({
        version: "1.5.0-nightly.20261015+abc1234",
        channel: "nightly",
        commit: "abc1234",
      }),
    ).toBe("v1.5.0-nightly.20261015+abc1234 (nightly)");
  });
});
