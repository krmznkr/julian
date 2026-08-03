// Google Calendar API as an Effect service.
//
// Pure calendar/event I/O: no OAuth mechanics (that is `google-auth`), no
// aggregation across sources (that is `calendar-year`). Every method is an
// `Effect.fn` so failures carry an operation label and each call produces a
// span.
import { Context, Effect, Layer, Option, Stream } from "effect";
import { HttpClientRequest } from "effect/unstable/http";
import { GoogleApiError, type GoogleApiFailure } from "@/lib/effect/errors";
import * as S from "@/lib/effect/schemas";
import type { CalendarEvent, CalendarSummary } from "@/domain";
import { GoogleHttp } from "@/lib/effect/google-http";

const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";

// A calendar event normalized away from Google's wire shape.
export interface NormalizedEvent {
  readonly id: string;
  readonly title: string;
  readonly description: string | undefined;
  readonly start: string;
  readonly end: string;
  readonly allDay: boolean;
  readonly isTimed: boolean;
  readonly htmlLink: string | undefined;
  readonly recurringEventId: string | undefined;
}

export interface GoogleCalendarApiShape {
  readonly listCalendars: Effect.Effect<ReadonlyArray<S.GoogleCalendarListItem>, GoogleApiFailure>;
  readonly listEvents: (
    calendarId: string,
    startDate: Date,
    endDate: Date,
  ) => Effect.Effect<ReadonlyArray<NormalizedEvent>, GoogleApiFailure>;
  readonly createEvent: (
    calendar: Pick<CalendarSummary, "id" | "summary" | "backgroundColor">,
    input: { readonly title: string; readonly date: string },
  ) => Effect.Effect<CalendarEvent, GoogleApiFailure>;
  readonly updateEvent: (
    calendarId: string,
    eventId: string,
    input: { readonly title: string },
  ) => Effect.Effect<void, GoogleApiFailure>;
  readonly deleteEvent: (
    calendarId: string,
    eventId: string,
  ) => Effect.Effect<void, GoogleApiFailure>;
}

export class GoogleCalendarApi extends Context.Service<GoogleCalendarApi, GoogleCalendarApiShape>()(
  "@julian/GoogleCalendar",
) {}

const normalize = (event: S.GoogleCalendarEvent): NormalizedEvent => {
  const allDay = event.start?.dateTime === undefined;
  return {
    id: event.id,
    title: event.summary === undefined || event.summary === "" ? "(No title)" : event.summary,
    description: event.description,
    htmlLink: event.htmlLink,
    recurringEventId: event.recurringEventId,
    start: event.start?.dateTime ?? event.start?.date ?? "",
    end: event.end?.dateTime ?? event.end?.date ?? "",
    allDay,
    isTimed: !allDay,
  };
};

// Parses a strict `YYYY-MM-DD` calendar date.
const parseIsoDate = (
  value: string,
): { readonly year: number; readonly month: number; readonly day: number } | undefined => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return undefined;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  return { year, month, day };
};

export const toUtcDateOnly = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const googleCalendarApiLayer: Layer.Layer<GoogleCalendarApi, never, GoogleHttp> =
  Layer.effect(
    GoogleCalendarApi,
    Effect.gen(function* () {
      const http = yield* GoogleHttp;

      const listCalendars = http
        .getJson(
          S.GoogleCalendarList,
          `${CALENDAR_BASE}/users/me/calendarList`,
          "GoogleCalendar.listCalendars",
          "Failed to fetch calendars",
        )
        .pipe(Effect.map((data) => data.items ?? []));

      const listEvents: GoogleCalendarApiShape["listEvents"] = Effect.fn(
        "GoogleCalendar.listEvents",
      )(function* (calendarId: string, startDate: Date, endDate: Date) {
        const baseParams = {
          timeMin: startDate.toISOString(),
          timeMax: endDate.toISOString(),
          singleEvents: "true",
          orderBy: "startTime",
          maxResults: "2500",
        };

        // Pagination is a stream rather than hand-rolled recursion: it is lazy,
        // interruptible, and cannot overflow the stack on a busy calendar.
        const pages = http.paginate(
          S.GoogleCalendarEventsPage,
          (pageToken) => {
            const params = new URLSearchParams(baseParams);
            if (Option.isSome(pageToken)) params.set("pageToken", pageToken.value);
            return `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
          },
          (page) => page.nextPageToken,
          "GoogleCalendar.listEvents",
          `Failed to fetch events from calendar ${calendarId}`,
        );

        const events = yield* pages.pipe(
          Stream.map((page) => page.items ?? []),
          Stream.flattenIterable,
          Stream.runCollect,
        );

        return events.map(normalize);
      });

      const createEvent: GoogleCalendarApiShape["createEvent"] = Effect.fn(
        "GoogleCalendar.createEvent",
      )(function* (
        calendar: Pick<CalendarSummary, "id" | "summary" | "backgroundColor">,
        input: { readonly title: string; readonly date: string },
      ) {
        // Reject a malformed date locally. Without this, `Number` yields NaN,
        // the end date becomes "NaN-NaN-NaN", and the user sees a generic
        // Google 400 instead of a clear local failure.
        const parsed = parseIsoDate(input.date);
        if (parsed === undefined) {
          return yield* new GoogleApiError({
            operation: "GoogleCalendar.createEvent",
            message: `Invalid event date: ${input.date}`,
            status: undefined,
            cause: undefined,
          });
        }
        const endDate = toUtcDateOnly(
          new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + 1)),
        );

        const request = HttpClientRequest.post(
          `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendar.id)}/events`,
        ).pipe(
          HttpClientRequest.bodyJsonUnsafe({
            summary: input.title,
            start: { date: input.date },
            end: { date: endDate },
          }),
        );

        const event = yield* http.json(
          S.CreatedEvent,
          request,
          "GoogleCalendar.createEvent",
          "Failed to create event",
        );

        return {
          id: event.id,
          title: event.summary === undefined || event.summary === "" ? input.title : event.summary,
          description: event.description ?? null,
          start: event.start?.dateTime ?? event.start?.date ?? input.date,
          end: event.end?.dateTime ?? event.end?.date ?? endDate,
          allDay: true,
          isTimed: false,
          calendarId: calendar.id,
          calendarColor: calendar.backgroundColor ?? null,
          calendarSummary: calendar.summary,
          htmlLink: event.htmlLink ?? null,
        } satisfies CalendarEvent;
      });

      const updateEvent: GoogleCalendarApiShape["updateEvent"] = Effect.fn(
        "GoogleCalendar.updateEvent",
      )(function* (calendarId: string, eventId: string, input: { readonly title: string }) {
        const request = HttpClientRequest.patch(
          `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        ).pipe(HttpClientRequest.bodyJsonUnsafe({ summary: input.title }));

        yield* http.send(request, "GoogleCalendar.updateEvent", "Failed to update event");
      });

      const deleteEvent: GoogleCalendarApiShape["deleteEvent"] = Effect.fn(
        "GoogleCalendar.deleteEvent",
      )(function* (calendarId: string, eventId: string) {
        const request = HttpClientRequest.delete(
          `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
        );

        // 410 Gone means the event was already deleted, which satisfies the
        // caller's intent just as well as a 204.
        yield* http.send(request, "GoogleCalendar.deleteEvent", "Failed to delete event", [410]);
      });

      return GoogleCalendarApi.of({
        listCalendars,
        listEvents,
        createEvent,
        updateEvent,
        deleteEvent,
      });
    }),
  );
