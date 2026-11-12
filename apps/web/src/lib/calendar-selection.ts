// Persists which calendars the user has hidden (deselected) rather than which
// are selected. Storing the hidden set means any newly discovered calendar —
// e.g. the Tasks calendar — shows by default unless the user explicitly hides
// it, while still remembering every deselection across refreshes.
//
// The Effect-returning functions are the real API and compose inside the app's
// service graph. The synchronous adapter implements the existing selection
// port for Foldkit Commands using a locally provided synchronous storage layer.
import { Effect, Option } from "effect";
import { KeyValueStore, keyValueStoreLayer } from "@julian/google/key-value-store";

const HIDDEN_CALENDARS_KEY = "julian:hidden-calendar-ids";

const parseHiddenIds = (raw: string): ReadonlyArray<string> => {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((id): id is string => typeof id === "string");
};

const readHiddenCalendarIds = Effect.gen(function* () {
  const store = yield* KeyValueStore;
  const stored = yield* store.get(HIDDEN_CALENDARS_KEY);

  return Option.match(stored, {
    onNone: (): ReadonlyArray<string> => [],
    onSome: (raw) => parseHiddenIds(raw),
  });
}).pipe(
  // Malformed JSON falls back to "nothing hidden": a corrupt preference should
  // never hide the user's calendars.
  Effect.catchDefect(() => Effect.succeed<ReadonlyArray<string>>([])),
);

export const resolveSelectedCalendarIds = Effect.fn("CalendarSelection.resolveSelected")(function* (
  availableIds: ReadonlyArray<string>,
) {
  const hidden = new Set(yield* readHiddenCalendarIds);
  return availableIds.filter((id) => !hidden.has(id));
});

const saveSelectedCalendarIds = Effect.fn("CalendarSelection.saveSelected")(function* (
  availableIds: ReadonlyArray<string>,
  selectedIds: ReadonlyArray<string>,
) {
  const store = yield* KeyValueStore;
  const selected = new Set(selectedIds);
  const hidden = availableIds.filter((id) => !selected.has(id));
  yield* store.set(HIDDEN_CALENDARS_KEY, JSON.stringify(hidden));
});

export function saveSelectedCalendarIdsSync(
  availableIds: ReadonlyArray<string>,
  selectedIds: ReadonlyArray<string>,
): void {
  Effect.runSync(
    saveSelectedCalendarIds(availableIds, selectedIds).pipe(Effect.provide(keyValueStoreLayer)),
  );
}
