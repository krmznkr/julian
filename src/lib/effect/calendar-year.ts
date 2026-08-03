// Aggregates a whole year of calendar + task data for the year view.
//
// This is the only place that decides how to degrade when *part* of the data is
// unavailable, which is a real product decision: one broken calendar should not
// blank the year. Unlike the previous implementation, a partial failure is
// logged through the Effect logger and reported back to the caller in
// `failures` rather than silently becoming an empty array, so the UI can tell
// "you have no events" apart from "we could not load them".
import { Effect } from "effect";
import { resolveSelectedCalendarIds } from "@/lib/calendar-selection";
import type { AppError, GoogleApiFailure } from "@/lib/effect/errors";
import type { CalendarEvent, CalendarSummary } from "@/domain";
import { GoogleCalendarApi } from "@/lib/effect/google-calendar-api";
import { GoogleTasks, type GoogleTasksShape } from "@/lib/effect/google-tasks";
import { AppConfig } from "@/lib/effect/config";

export const TASKS_CALENDAR_ID = "__google_tasks__";
const TASKS_CALENDAR_COLOR = "#8b5cf6";

export interface YearData {
  readonly calendars: ReadonlyArray<CalendarSummary>;
  readonly selectedCalendarIds: ReadonlyArray<string>;
  readonly events: ReadonlyArray<CalendarEvent>;
  // Sources that could not be loaded. Empty means the year is complete.
  readonly failures: ReadonlyArray<{ readonly source: string; readonly message: string }>;
}

interface Partial<A> {
  readonly value: A;
  readonly failure: { readonly source: string; readonly message: string } | undefined;
}

// Recover a non-critical source to a fallback value while keeping evidence of
// what went wrong, instead of discarding the error.
const optional = <A, E extends AppError, R>(
  source: string,
  fallback: A,
  effect: Effect.Effect<A, E, R>,
): Effect.Effect<Partial<A>, never, R> =>
  effect.pipe(
    Effect.map((value): Partial<A> => ({ value, failure: undefined })),
    Effect.catch((error: E) =>
      Effect.logWarning(`Failed to load ${source}`).pipe(
        Effect.annotateLogs({ source, error: error.message }),
        Effect.as<Partial<A>>({
          value: fallback,
          failure: { source, message: error.message },
        }),
      ),
    ),
  );

const tasksCalendar: CalendarSummary = {
  id: TASKS_CALENDAR_ID,
  summary: "Tasks",
  backgroundColor: TASKS_CALENDAR_COLOR,
  foregroundColor: "#ffffff",
  accessRole: "reader",
};

export const loadCalendarYear = Effect.fn("CalendarYear.load")(function* (year: number) {
  const config = yield* AppConfig;
  const calendarApi = yield* GoogleCalendarApi;
  const tasksApi = yield* GoogleTasks;

  // The calendar list is critical: without it there is nothing to render, so
  // this failure stays in the error channel.
  const calendars = yield* calendarApi.listCalendars;

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  const perCalendar = yield* Effect.forEach(
    calendars,
    (calendar) =>
      optional(
        `calendar:${calendar.id}`,
        [] as ReadonlyArray<CalendarEvent>,
        calendarApi.listEvents(calendar.id, startDate, endDate).pipe(
          Effect.map((events) =>
            events.map(
              (event): CalendarEvent => ({
                ...event,
                description: event.description ?? null,
                htmlLink: event.htmlLink ?? null,
                calendarId: calendar.id,
                calendarColor: calendar.backgroundColor ?? null,
                calendarSummary: calendar.summary,
              }),
            ),
          ),
        ),
      ),
    { concurrency: config.apiConcurrency },
  );

  const taskEvents = yield* optional(
    "tasks",
    [] as ReadonlyArray<CalendarEvent>,
    loadTaskEvents(tasksApi, year, config.apiConcurrency),
  );

  const allCalendars = [...calendars, tasksCalendar];
  const failures = [...perCalendar, taskEvents].flatMap((result) =>
    result.failure === undefined ? [] : [result.failure],
  );

  const selectedCalendarIds = yield* resolveSelectedCalendarIds(
    allCalendars.map((calendar) => calendar.id),
  );

  return {
    calendars: allCalendars,
    selectedCalendarIds,
    events: [...perCalendar.flatMap((result) => result.value), ...taskEvents.value],
    failures,
  } satisfies YearData;
});

const loadTaskEvents = (
  tasksApi: GoogleTasksShape,
  year: number,
  concurrency: number,
): Effect.Effect<ReadonlyArray<CalendarEvent>, GoogleApiFailure> =>
  Effect.gen(function* () {
    const lists = yield* tasksApi.listTaskLists;

    const perList = yield* Effect.forEach(
      lists,
      (list) => optional(`task-list:${list.id}`, [], tasksApi.listTasks(list.id)),
      { concurrency },
    );

    return perList
      .flatMap((result) => result.value)
      .flatMap((task): ReadonlyArray<CalendarEvent> => {
        if (task.due === undefined || task.status === "completed") return [];

        const due = new Date(task.due);
        const start = toUtcDateOnly(due);
        const end = toUtcDateOnly(
          new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate() + 1)),
        );

        return [
          {
            id: `task:${task.id}`,
            title: task.title === undefined || task.title === "" ? "(No title)" : task.title,
            description: task.notes ?? null,
            start,
            end,
            allDay: true,
            isTimed: false,
            calendarId: TASKS_CALENDAR_ID,
            calendarColor: TASKS_CALENDAR_COLOR,
            calendarSummary: "Tasks",
            htmlLink: null,
          },
        ];
      })
      .filter((event) => Number(event.start.slice(0, 4)) === year);
  });

const toUtcDateOnly = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
