// The three seams that separate the year view from the outside world.
//
// The live app plugs in the TanStack router, the Google Calendar API and the
// stored calendar-selection preference. The landing page plugs in local state,
// a fixture year and an in-memory event store, which is what lets the marketing
// site run the *real* year view instead of a lookalike.
import type { CalendarEvent, CalendarSummary } from "@/domain";
import type { YearViewSearch } from "@/lib/year-view-url";

/** Where the year view reads and writes its focus (month / day / details open). */
export type YearViewRouterPort = {
  readonly search: YearViewSearch;
  readonly navigate: (target: { year: number; search: YearViewSearch; replace: boolean }) => void;
};

export type YearViewLoadResult = {
  readonly calendars: ReadonlyArray<CalendarSummary>;
  readonly selectedCalendarIds: ReadonlyArray<string>;
  readonly events: ReadonlyArray<CalendarEvent>;
};

/** Where the year view gets its calendars and events, and where hidden calendars are remembered. */
export type YearViewDataSource = {
  readonly load: (year: number) => Promise<YearViewLoadResult>;
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
  ) => Promise<CalendarEvent>;
  readonly updateEvent: (
    calendarId: string,
    eventId: string,
    input: { title: string },
  ) => Promise<void>;
  readonly deleteEvent: (calendarId: string, eventId: string) => Promise<void>;
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
