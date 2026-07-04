// Persists which calendars the user has hidden (deselected) rather than which
// are selected. Storing the hidden set means any newly discovered calendar —
// e.g. the Tasks calendar — shows by default unless the user explicitly hides
// it, while still remembering every deselection across refreshes.
const HIDDEN_CALENDARS_KEY = "julian:hidden-calendar-ids";

function getHiddenCalendarIds(): string[] {
  try {
    const stored = window.localStorage.getItem(HIDDEN_CALENDARS_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

export function saveSelectedCalendarIds(availableIds: string[], selectedIds: string[]) {
  const selected = new Set(selectedIds);
  const hidden = availableIds.filter((id) => !selected.has(id));
  window.localStorage.setItem(HIDDEN_CALENDARS_KEY, JSON.stringify(hidden));
}

export function resolveSelectedCalendarIds(availableIds: string[]): string[] {
  const hidden = new Set(getHiddenCalendarIds());
  return availableIds.filter((id) => !hidden.has(id));
}
