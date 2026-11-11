// The seams that separate the year view from the outside world.
//
// Foldkit owns routing and UI preferences. The live app plugs in the Google
// Calendar API and stored selection; the demo plugs in fixture years and an
// in-memory store. Both render the same view and run the same update function.
import type { Effect } from "effect";
import type { CalendarEvent, CalendarSummary } from "@julian/domain";

/**
 * Why a load or a write failed. Every adapter's typed errors carry a tag and a
 * message for the user; the year view needs nothing more from them.
 */
export type YearViewFailure = {
  readonly _tag: string;
  readonly message: string;
};

export type YearSourceFailure = {
  readonly source: string;
  readonly message: string;
};

export type YearViewLoadResult = {
  readonly calendars: ReadonlyArray<CalendarSummary>;
  readonly selectedCalendarIds: ReadonlyArray<string>;
  readonly events: ReadonlyArray<CalendarEvent>;
  /**
   * Calendars or task lists that could not be loaded while the rest succeeded.
   * Empty means the year is complete — which is what lets the sidebar say "we
   * could not load these" instead of implying you have no events.
   */
  readonly failures: ReadonlyArray<YearSourceFailure>;
};

/**
 * Where the year view gets its calendars and events, and where hidden calendars
 * are remembered. Loads and writes are Effects with no requirements, so the
 * year view runs them as fibers it can interrupt when a load is superseded or
 * the view unmounts.
 */
export type YearViewDataSource = {
  readonly load: (year: number) => Effect.Effect<YearViewLoadResult, YearViewFailure>;
  readonly persistSelection: (
    availableIds: ReadonlyArray<string>,
    selectedIds: ReadonlyArray<string>,
  ) => void;
};

/** How the year view creates, renames and removes events. */
export type YearViewEventApi = {
  readonly createEvent: (
    calendar: Pick<CalendarSummary, "id" | "summary" | "backgroundColor">,
    input: { title: string; date: string },
  ) => Effect.Effect<CalendarEvent, YearViewFailure>;
  readonly updateEvent: (
    calendarId: string,
    eventId: string,
    input: { title: string },
  ) => Effect.Effect<void, YearViewFailure>;
  /** Reschedules an all-day event; dates are `YYYY-MM-DD`, `end` exclusive. */
  readonly moveEvent: (
    calendarId: string,
    eventId: string,
    dates: { start: string; end: string },
  ) => Effect.Effect<void, YearViewFailure>;
  readonly deleteEvent: (
    calendarId: string,
    eventId: string,
  ) => Effect.Effect<void, YearViewFailure>;
};
