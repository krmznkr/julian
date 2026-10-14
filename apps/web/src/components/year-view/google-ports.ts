// The live year-view ports: Google Calendar for data and writes.
//
// `provide` supplies the app services, which leaves each port an Effect with no
// requirements that the year view can fork and interrupt. The app passes the
// shared runtime's `provideApp`; tests pass a layer over a stubbed fetch.
import { Effect } from "effect";
import { GoogleAuth } from "@julian/google/google-auth";
import { GoogleCalendarApi } from "@julian/google/google-calendar-api";
import type {
  YearViewDataSource,
  YearViewEventApi,
  YearViewLoadResult,
} from "@/components/year-view/year-view-ports";
import { saveSelectedCalendarIdsSync } from "@/lib/calendar-selection";
import { loadCalendarYear } from "@/lib/effect/calendar-year";
import type { AppServices } from "@/lib/effect/runtime";

type Provide = <A, E>(effect: Effect.Effect<A, E, AppServices>) => Effect.Effect<A, E>;

const EMPTY_YEAR: YearViewLoadResult = {
  calendars: [],
  selectedCalendarIds: [],
  events: [],
  failures: [],
};

export function makeGoogleDataSource(provide: Provide): YearViewDataSource {
  return {
    // No dummy data: until Google Calendar is connected the view is empty and
    // the sidebar just offers the Connect button.
    load: (year) =>
      provide(
        Effect.gen(function* () {
          const auth = yield* GoogleAuth;
          if (!(yield* auth.isAuthenticated)) return EMPTY_YEAR;
          return yield* loadCalendarYear(year);
        }),
      ),
    persistSelection: saveSelectedCalendarIdsSync,
  };
}

export function makeGoogleEventApi(provide: Provide): YearViewEventApi {
  const withCalendar = <A, E>(
    f: (api: GoogleCalendarApi["Service"]) => Effect.Effect<A, E>,
  ): Effect.Effect<A, E> => provide(Effect.flatMap(GoogleCalendarApi, f));

  return {
    createEvent: (calendar, input) => withCalendar((api) => api.createEvent(calendar, input)),
    updateEvent: (calendarId, eventId, input) =>
      withCalendar((api) => api.updateEvent(calendarId, eventId, input)),
    deleteEvent: (calendarId, eventId) =>
      withCalendar((api) => api.deleteEvent(calendarId, eventId)),
  };
}
