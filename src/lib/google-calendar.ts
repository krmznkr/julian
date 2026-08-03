// Promise-based facade over the Effect layer.
//
// The real implementations are services in `@/lib/effect/*`. This module
// resolves them from the shared app runtime so existing React consumers keep
// their `async`/`await` call sites unchanged, while errors surface as plain
// `Error`s that still carry the tagged error's `_tag`/`status`.
import { Effect } from "effect";
import { toError } from "@/lib/effect/errors";
import { runPromise, type AppServices } from "@/lib/effect/runtime";
import type { CalendarEvent, CalendarSummary } from "@/domain";
import { GoogleAuth, GoogleAuthShape } from "@/lib/effect/google-auth";
import { GoogleCalendarApi, GoogleCalendarApiShape } from "@/lib/effect/google-calendar-api";
import { TASKS_CALENDAR_ID as TASKS_CALENDAR, loadCalendarYear } from "@/lib/effect/calendar-year";

export const TASKS_CALENDAR_ID = TASKS_CALENDAR;

const WRITABLE_ROLES = new Set(["owner", "writer"]);

// Pure helpers — no Effect execution needed.
export function isWritableCalendar(
  calendar: Pick<CalendarSummary, "id" | "accessRole"> | undefined | null,
): boolean {
  if (!calendar) return false;
  if (calendar.id === TASKS_CALENDAR_ID) return false;
  return calendar.accessRole == null || WRITABLE_ROLES.has(calendar.accessRole);
}

export function getDefaultWritableCalendar(calendars: CalendarSummary[]): CalendarSummary | null {
  const primary = calendars.find((calendar) => calendar.primary && isWritableCalendar(calendar));
  if (primary) return primary;
  return calendars.find((calendar) => isWritableCalendar(calendar)) ?? null;
}

// Run on the app runtime, then normalize to an `Error` that preserves the
// tagged error's metadata so consumers can still branch on auth failures.
const run = <A, E>(effect: Effect.Effect<A, E, AppServices>): Promise<A> =>
  runPromise(effect).catch((error: unknown) => {
    throw toError(error);
  });

const withAuth = <A, E>(
  f: (service: GoogleAuthShape) => Effect.Effect<A, E, AppServices>,
): Promise<A> => run(Effect.flatMap(GoogleAuth, f));

const withCalendar = <A, E>(
  f: (service: GoogleCalendarApiShape) => Effect.Effect<A, E, AppServices>,
): Promise<A> => run(Effect.flatMap(GoogleCalendarApi, f));

export function startGoogleAuth(): Promise<void> {
  return withAuth((auth) => auth.start);
}

export function handleAuthCallback(code: string, redirectUri?: string): Promise<void> {
  return withAuth((auth) => auth.handleCallback(code, redirectUri));
}

export function isAuthenticated(): Promise<boolean> {
  return withAuth((auth) => auth.isAuthenticated);
}

export function logout(): Promise<void> {
  return withAuth((auth) => auth.logout);
}

export function getCalendars(): Promise<ReadonlyArray<CalendarSummary>> {
  return withCalendar((calendar) => calendar.listCalendars);
}

export function getEvents(calendarId: string, startDate: Date, endDate: Date) {
  return withCalendar((calendar) => calendar.listEvents(calendarId, startDate, endDate));
}

export function createEvent(
  calendar: Pick<CalendarSummary, "id" | "summary" | "backgroundColor">,
  input: { title: string; date: string },
): Promise<CalendarEvent> {
  return withCalendar((service) => service.createEvent(calendar, input));
}

export function updateEvent(
  calendarId: string,
  eventId: string,
  input: { title: string },
): Promise<void> {
  return withCalendar((service) => service.updateEvent(calendarId, eventId, input));
}

export function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  return withCalendar((service) => service.deleteEvent(calendarId, eventId));
}

export function loadGoogleYearData(year: number) {
  return run(loadCalendarYear(year));
}
