// Browser navigation as an Effect service.
//
// `location.assign` and `window.open` are the app's only "leave the page" side
// effects. Behind a service they can be observed in tests (which previously
// could not assert on a redirect without stubbing globals) and they keep the
// OAuth flow expressible as a single composable effect.
import { Context, Effect, Layer, Ref } from "effect";

export interface NavigationShape {
  // Navigate the current tab.
  readonly assign: (url: string) => Effect.Effect<void>;
  // Open a URL in a new tab.
  readonly openExternal: (url: string) => Effect.Effect<void>;
}

export class Navigation extends Context.Service<Navigation, NavigationShape>()(
  "@julian/Navigation",
) {}

export const navigationLayer: Layer.Layer<Navigation> = Layer.sync(Navigation, () =>
  Navigation.of({
    assign: Effect.fn("Navigation.assign")(function* (url: string) {
      yield* Effect.sync(() => {
        location.assign(url);
      });
    }),

    openExternal: Effect.fn("Navigation.openExternal")(function* (url: string) {
      yield* Effect.sync(() => {
        window.open(url, "_blank", "noopener,noreferrer");
      }).pipe(Effect.catchDefect(() => Effect.void));
    }),
  }),
);

export interface NavigationCall {
  readonly kind: "assign" | "open";
  readonly url: string;
}

// Records navigations instead of performing them, so tests can assert on the
// OAuth redirect URL.
export const recordingNavigationLayer = (
  ref: Ref.Ref<ReadonlyArray<NavigationCall>>,
): Layer.Layer<Navigation> =>
  Layer.succeed(Navigation, {
    assign: (url) =>
      Ref.update(
        ref,
        (calls): ReadonlyArray<NavigationCall> => [...calls, { kind: "assign", url }],
      ),
    openExternal: (url) =>
      Ref.update(ref, (calls): ReadonlyArray<NavigationCall> => [...calls, { kind: "open", url }]),
  });
