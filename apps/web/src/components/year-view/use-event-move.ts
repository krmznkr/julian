// Moving an all-day event to another day, optimistically.
//
// The grid shows the event on its new day at once; the write runs as a fiber,
// and if it fails (or is interrupted before it lands) the event goes back to
// where it was and the failure is reported. Drag-and-drop and the keyboard's
// move dialog both end up in `move`.
import { useCallback, useEffect, useRef, useState } from "react";
import { Effect, Exit, Option, type Fiber } from "effect";
import type { YearViewAction } from "@/components/year-view-reducer";
import type { YearViewEventApi } from "@/components/year-view/year-view-ports";
import type { CalendarEvent } from "@julian/domain";

const DAY_MS = 24 * 60 * 60 * 1000;

const toUtc = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
const fromUtc = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** New exclusive-end dates for an all-day event that should start on `date`. */
export function moveAllDayDates(
  event: Pick<CalendarEvent, "start" | "end">,
  date: string,
): { start: string; end: string } {
  const days = Math.max(1, Math.round((toUtc(event.end) - toUtc(event.start)) / DAY_MS));
  return { start: date, end: fromUtc(toUtc(date) + days * DAY_MS) };
}

export function canMoveEvent(event: CalendarEvent, canModify: (event: CalendarEvent) => boolean) {
  return event.allDay && canModify(event);
}

export function useEventMove({
  eventApi,
  dispatch,
}: {
  eventApi: YearViewEventApi;
  dispatch: (action: YearViewAction) => void;
}) {
  const [target, setTarget] = useState<CalendarEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Moves are independent: a second drag must not cancel the first one's write.
  const fibers = useRef(new Set<Fiber.Fiber<void>>());
  useEffect(() => {
    const running = fibers.current;
    return () => running.forEach((fiber) => fiber.interruptUnsafe());
  }, []);

  const move = useCallback(
    (event: CalendarEvent, date: string) => {
      const dates = moveAllDayDates(event, date);
      if (dates.start === event.start.slice(0, 10)) return;
      const update = (changes: { start: string; end: string }) =>
        dispatch({ type: "EVENT_UPDATED", id: event.id, calendarId: event.calendarId, changes });

      setError(null);
      update(dates);
      const fiber = Effect.runFork(
        eventApi.moveEvent(event.calendarId, event.id, dates).pipe(
          Effect.onExit((exit) =>
            Exit.isSuccess(exit)
              ? Effect.void
              : Effect.sync(() => {
                  update({ start: event.start, end: event.end });
                  const failure = Exit.findErrorOption(exit);
                  setError(
                    Option.isSome(failure)
                      ? `Could not move “${event.title}”: ${failure.value.message}`
                      : null,
                  );
                }),
          ),
          Effect.ignore,
        ),
      );
      fibers.current.add(fiber);
      fiber.addObserver(() => fibers.current.delete(fiber));
    },
    [dispatch, eventApi],
  );

  return {
    move,
    error,
    dismissError: useCallback(() => setError(null), []),
    /** The event the keyboard move dialog is open for. */
    target,
    open: setTarget,
    close: useCallback(() => setTarget(null), []),
  };
}
