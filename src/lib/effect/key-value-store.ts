// Browser key/value storage as an Effect service.
//
// Previously these were free functions closing over `window.localStorage`,
// which meant every consumer was pinned to real browser storage and tests had
// to mutate global state. As a service, the live layer talks to `localStorage`
// while tests provide `keyValueStoreMemoryLayer()` and get deterministic,
// isolated storage.
//
// Storage access is best-effort by design: `localStorage` throws in privacy
// mode and is absent outside the DOM. Those failures are recovered here (reads
// yield `None`, writes no-op) because no caller has a better response.
import { Context, Effect, Layer, Option, Ref } from "effect";

export interface KeyValueStoreShape {
  readonly get: (key: string) => Effect.Effect<Option.Option<string>>;
  readonly set: (key: string, value: string) => Effect.Effect<void>;
  readonly remove: (key: string) => Effect.Effect<void>;
}

export class KeyValueStore extends Context.Service<KeyValueStore, KeyValueStoreShape>()(
  "@julian/KeyValueStore",
) {}

const isAvailable = (): boolean => typeof window !== "undefined" && "localStorage" in window;

export const keyValueStoreLayer: Layer.Layer<KeyValueStore> = Layer.sync(KeyValueStore, () =>
  KeyValueStore.of({
    get: Effect.fn("KeyValueStore.get")(function* (key: string) {
      return yield* Effect.sync(() =>
        isAvailable() ? Option.fromNullishOr(window.localStorage.getItem(key)) : Option.none(),
      ).pipe(Effect.catchDefect(() => Effect.succeed(Option.none<string>())));
    }),

    set: Effect.fn("KeyValueStore.set")(function* (key: string, value: string) {
      yield* Effect.sync(() => {
        if (isAvailable()) window.localStorage.setItem(key, value);
      }).pipe(Effect.catchDefect(() => Effect.void));
    }),

    remove: Effect.fn("KeyValueStore.remove")(function* (key: string) {
      yield* Effect.sync(() => {
        if (isAvailable()) window.localStorage.removeItem(key);
      }).pipe(Effect.catchDefect(() => Effect.void));
    }),
  }),
);

// An in-memory store for tests: no globals, no cleanup between cases.
export const keyValueStoreMemoryLayer = (
  initial?: Readonly<Record<string, string>>,
): Layer.Layer<KeyValueStore> =>
  Layer.effect(
    KeyValueStore,
    Effect.gen(function* () {
      const ref = yield* Ref.make(new Map(Object.entries(initial ?? {})));

      return KeyValueStore.of({
        get: (key) => Ref.get(ref).pipe(Effect.map((map) => Option.fromNullishOr(map.get(key)))),
        set: (key, value) => Ref.update(ref, (map) => new Map([...map, [key, value]])),
        remove: (key) => Ref.update(ref, (map) => new Map([...map].filter(([k]) => k !== key))),
      });
    }),
  );
