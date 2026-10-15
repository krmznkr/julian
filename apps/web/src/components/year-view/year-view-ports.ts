// The four seams that separate the year view from the outside world.
//
// The live app plugs in the TanStack router, the Google Calendar API and the
// stored calendar-selection preference. The landing page plugs in local state,
// a fixture year and an in-memory event store, which is what lets the marketing
// site run the *real* year view instead of a lookalike.
import type { Effect } from "effect";
import type { CalendarEvent, CalendarSummary } from "@julian/domain";
import type { YearViewSearch } from "@/lib/year-view-url";

/** Where the year view reads and writes its focus (month / day / details open). */
export type YearViewRouterPort = {
  readonly search: YearViewSearch;
  readonly navigate: (target: { year: number; search: YearViewSearch; replace: boolean }) => void;
};

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

/**
 * Where the collapsed-sidebar preference is remembered. The landing page keeps
 * it in memory: the scripted tour toggles the sidebar, and that must not leak
 * into the visitor's signed-in app.
 */
export type YearViewPreferences = {
  readonly getSidebarCollapsed: () => boolean;
  readonly setSidebarCollapsed: (collapsed: boolean) => void;
};
