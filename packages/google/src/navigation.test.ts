// The live and recording navigation layers.
//
// The live layer is the only code that leaves the page, so these cases stub
// `location` and `window` and assert on the exact browser calls.
import { afterEach, describe, expect, vi } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Ref } from "effect";
import {
  Navigation,
  NavigationCall,
  navigationLayer,
  recordingNavigationLayer,
} from "./navigation";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("navigationLayer", () => {
  it.effect("assign navigates the current tab", () =>
    Effect.gen(function* () {
      const assign = vi.fn<(url: string) => void>();
      vi.stubGlobal("location", { assign });

      const navigation = yield* Navigation;
      yield* navigation.assign("https://accounts.google.com/o/oauth2/v2/auth?x=1");

      expect(assign).toHaveBeenCalledExactlyOnceWith(
        "https://accounts.google.com/o/oauth2/v2/auth?x=1",
      );
    }).pipe(Effect.provide(navigationLayer)),
  );

  it.effect("openExternal opens a new tab without opener or referrer", () =>
    Effect.gen(function* () {
      const open = vi.fn<(url: string, target: string, features: string) => void>();
      vi.stubGlobal("window", { open });

      const navigation = yield* Navigation;
      yield* navigation.openExternal("https://calendar.google.com/");

      expect(open).toHaveBeenCalledExactlyOnceWith(
        "https://calendar.google.com/",
        "_blank",
        "noopener,noreferrer",
      );
    }).pipe(Effect.provide(navigationLayer)),
  );

  it.effect("openExternal swallows a browser that refuses to open", () =>
    Effect.gen(function* () {
      const open = vi.fn<(url: string, target: string, features: string) => void>(() => {
        throw new Error("blocked");
      });
      vi.stubGlobal("window", { open });

      const navigation = yield* Navigation;
      yield* navigation.openExternal("https://calendar.google.com/");

      expect(open).toHaveBeenCalledOnce();
    }).pipe(Effect.provide(navigationLayer)),
  );
});

describe("recordingNavigationLayer", () => {
  it.effect("records both kinds of navigation in order", () =>
    Effect.gen(function* () {
      const calls = yield* Ref.make<ReadonlyArray<NavigationCall>>([]);

      yield* Effect.gen(function* () {
        const navigation = yield* Navigation;
        yield* navigation.assign("https://a.example/");
        yield* navigation.openExternal("https://b.example/");
      }).pipe(Effect.provide(recordingNavigationLayer(calls)));

      expect(yield* Ref.get(calls)).toEqual([
        { kind: "assign", url: "https://a.example/" },
        { kind: "open", url: "https://b.example/" },
      ]);
    }),
  );
});
