import { describe, expect, it } from "vitest";
import { isPreviewOrigin, previewCallbackTarget } from "./preview-origin";

const PREVIEW = "https://pr-109-julian.julian-93527c9983d1.workers.dev";

describe("isPreviewOrigin", () => {
  it.each([
    [PREVIEW, true],
    ["https://pr-1-julian.julian-93527c9983d1.workers.dev", true],
    ["https://pr-0-julian.julian-93527c9983d1.workers.dev", false],
    ["http://pr-109-julian.julian-93527c9983d1.workers.dev", false],
    ["https://pr-109-julian.julian-93527c9983d1.workers.dev.evil.example", false],
    ["https://pr-109-julian.other-account.workers.dev", false],
    ["https://pr-109-julian-nightly.julian-93527c9983d1.workers.dev", false],
    [`${PREVIEW}/`, false],
    ["https://julian.krmznkr.com", false],
  ])("%s → %s", (origin, expected) => {
    expect(isPreviewOrigin(origin)).toBe(expected);
  });
});

describe("previewCallbackTarget", () => {
  const callback = (origin: string, search: string) => ({
    origin,
    search,
    state: /[?&]state=([^&]*)/.exec(search)?.[1] ?? null,
  });

  it("forwards production callbacks that name a preview, keeping the query", () => {
    const search = `?state=${PREVIEW}&code=abc&scope=x`;
    expect(previewCallbackTarget(callback("https://julian.krmznkr.com", search))).toBe(
      `${PREVIEW}/auth/callback${search}`,
    );
  });

  it("leaves ordinary callbacks, foreign states and the preview itself alone", () => {
    expect(previewCallbackTarget(callback("https://julian.krmznkr.com", "?code=abc"))).toBeNull();
    expect(
      previewCallbackTarget(
        callback("https://julian.krmznkr.com", "?code=abc&state=https://evil.example"),
      ),
    ).toBeNull();
    expect(previewCallbackTarget(callback(PREVIEW, `?code=abc&state=${PREVIEW}`))).toBeNull();
  });
});
