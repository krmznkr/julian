import { describe, expect, it } from "vitest";
import { chord } from "@/components/landing/demo-input";

describe("chord", () => {
  it("maps a bare letter to its physical code", () => {
    expect(chord("t")).toMatchObject({ key: "t", code: "KeyT", shiftKey: false, metaKey: false });
  });

  it("uppercases the key under Shift, the way a browser reports it", () => {
    // The year view reads Shift+letter shortcuts from `key`, so this has to
    // match what a real keyboard produces or Shift+T would never toggle theme.
    expect(chord("Shift+t")).toMatchObject({ key: "T", code: "KeyT", shiftKey: true });
  });

  it("keeps digits addressable by code, which survives Shift", () => {
    expect(chord("Shift+3")).toMatchObject({ key: "3", code: "Digit3", shiftKey: true });
  });

  it("passes named keys through untouched", () => {
    expect(chord("Shift+ArrowRight")).toMatchObject({
      key: "ArrowRight",
      code: "ArrowRight",
      shiftKey: true,
    });
  });

  it("renders Mac keycaps in modifier order", () => {
    expect(chord("Meta+k").caps).toEqual(["⌘", "K"]);
    expect(chord("Shift+t").caps).toEqual(["⇧", "T"]);
    expect(chord("Escape").caps).toEqual(["esc"]);
  });
});
