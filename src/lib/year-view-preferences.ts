// Sidebar collapsed preference, persisted through the app's storage service.
//
// The React call sites read this during render, so a synchronous wrapper runs
// the effect on a locally provided storage layer.
import { Effect, Option } from "effect";
import { KeyValueStore, keyValueStoreLayer } from "@/lib/effect/key-value-store";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "julian.yearView.sidebarCollapsed";

const readSidebarCollapsed = Effect.gen(function* () {
  const store = yield* KeyValueStore;
  const stored = yield* store.get(SIDEBAR_COLLAPSED_STORAGE_KEY);

  return Option.match(stored, {
    onNone: () => false,
    onSome: (value) => value === "true",
  });
});

export const storeSidebarCollapsed = Effect.fn("YearViewPreferences.storeSidebarCollapsed")(
  function* (collapsed: boolean) {
    const store = yield* KeyValueStore;
    yield* store.set(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? "true" : "false");
  },
);

export function getStoredSidebarCollapsedPreference(): boolean {
  return Effect.runSync(readSidebarCollapsed.pipe(Effect.provide(keyValueStoreLayer)));
}

export function storeSidebarCollapsedPreference(collapsed: boolean): void {
  Effect.runSync(storeSidebarCollapsed(collapsed).pipe(Effect.provide(keyValueStoreLayer)));
}
