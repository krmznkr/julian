// The live `localStorage` layer and its best-effort failure handling.
//
// Each case stubs `window` with the storage it needs: a working one, none at
// all, or one that throws the way privacy mode and full quotas do.
import { afterEach, describe, expect, vi } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Option } from "effect";
import { KeyValueStore, keyValueStoreLayer, keyValueStoreMemoryLayer } from "./key-value-store";

const memoryStorage = (): Storage => {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
};

const throwingStorage = (): Storage => {
  const fail = () => {
    throw new DOMException("The operation is insecure.", "SecurityError");
  };
  return {
    length: 0,
    clear: fail,
    key: fail,
    getItem: fail,
    setItem: fail,
    removeItem: fail,
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("keyValueStoreLayer", () => {
  it.effect("reads, writes and removes through localStorage", () =>
    Effect.gen(function* () {
      const storage = memoryStorage();
      vi.stubGlobal("window", { localStorage: storage });

      const store = yield* KeyValueStore;
      expect(yield* store.get("julian.key")).toEqual(Option.none());

      yield* store.set("julian.key", "value");
      expect(storage.getItem("julian.key")).toBe("value");
      expect(yield* store.get("julian.key")).toEqual(Option.some("value"));

      yield* store.remove("julian.key");
      expect(storage.getItem("julian.key")).toBeNull();
      expect(yield* store.get("julian.key")).toEqual(Option.none());
    }).pipe(Effect.provide(keyValueStoreLayer)),
  );

  it.effect("reads None and no-ops outside the DOM", () =>
    Effect.gen(function* () {
      expect(typeof window).toBe("undefined");

      const store = yield* KeyValueStore;
      yield* store.set("julian.key", "value");
      yield* store.remove("julian.key");
      expect(yield* store.get("julian.key")).toEqual(Option.none());
    }).pipe(Effect.provide(keyValueStoreLayer)),
  );

  it.effect("reads None and no-ops when the window has no localStorage", () =>
    Effect.gen(function* () {
      vi.stubGlobal("window", {});

      const store = yield* KeyValueStore;
      yield* store.set("julian.key", "value");
      yield* store.remove("julian.key");
      expect(yield* store.get("julian.key")).toEqual(Option.none());
    }).pipe(Effect.provide(keyValueStoreLayer)),
  );

  it.effect("does not throw when every storage call throws", () =>
    Effect.gen(function* () {
      const storage = throwingStorage();
      const getItem = vi.spyOn(storage, "getItem");
      const setItem = vi.spyOn(storage, "setItem");
      const removeItem = vi.spyOn(storage, "removeItem");
      vi.stubGlobal("window", { localStorage: storage });

      const store = yield* KeyValueStore;
      expect(yield* store.get("julian.key")).toEqual(Option.none());
      yield* store.set("julian.key", "value");
      yield* store.remove("julian.key");

      // The calls reached storage and their failures were absorbed.
      expect(getItem).toHaveBeenCalledOnce();
      expect(setItem).toHaveBeenCalledOnce();
      expect(removeItem).toHaveBeenCalledOnce();
    }).pipe(Effect.provide(keyValueStoreLayer)),
  );

  it.effect("does not throw when reading localStorage itself throws", () =>
    Effect.gen(function* () {
      // Some browsers throw on the property access rather than on the call.
      vi.stubGlobal(
        "window",
        Object.defineProperty({}, "localStorage", {
          get: () => {
            throw new DOMException("The operation is insecure.", "SecurityError");
          },
        }),
      );

      const store = yield* KeyValueStore;
      expect(yield* store.get("julian.key")).toEqual(Option.none());
      yield* store.set("julian.key", "value");
      yield* store.remove("julian.key");
    }).pipe(Effect.provide(keyValueStoreLayer)),
  );
});

describe("keyValueStoreMemoryLayer", () => {
  it.effect("starts from the initial record and stays isolated", () =>
    Effect.gen(function* () {
      const store = yield* KeyValueStore;
      expect(yield* store.get("seeded")).toEqual(Option.some("yes"));

      yield* store.set("other", "1");
      yield* store.remove("seeded");
      expect(yield* store.get("seeded")).toEqual(Option.none());
      expect(yield* store.get("other")).toEqual(Option.some("1"));
    }).pipe(Effect.provide(keyValueStoreMemoryLayer({ seeded: "yes" }))),
  );
});
