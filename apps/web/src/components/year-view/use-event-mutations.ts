import { useCallback, useRef, useState } from "react";
import type { YearViewAction } from "@/components/year-view-reducer";
import type { KeyboardCell } from "@/components/year-view/year-grid-keyboard";
import type { YearViewEventApi } from "@/components/year-view/year-view-ports";
import type { CalendarEvent, CalendarSummary } from "@/domain";

export type MutationSlot<T> = {
  readonly target: T | null;
  readonly isOpen: boolean;
  readonly submitting: boolean;
  readonly error: string | null;
  readonly open: (target: T) => void;
  /** Matches Radix's `onOpenChange`; only the close direction does anything. */
  readonly setOpen: (open: boolean) => void;
};

type MutationSlotInternals<T> = MutationSlot<T> & {
  readonly run: (perform: (target: T) => Promise<void>, fallbackMessage: string) => Promise<void>;
};

function useMutationSlot<T>(onSettled: () => void): MutationSlotInternals<T> {
  const [target, setTarget] = useState<T | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const open = useCallback((next: T) => {
    if (inFlight.current) return;
    setError(null);
    setTarget(next);
  }, []);

  const setOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen || inFlight.current) return;
      setTarget(null);
      setError(null);
      onSettled();
    },
    [onSettled],
  );

  const run = useCallback(
    async (perform: (current: T) => Promise<void>, fallbackMessage: string) => {
      if (target === null || inFlight.current) return;
      inFlight.current = true;
      setSubmitting(true);
      setError(null);
      try {
        await perform(target);
        setTarget(null);
        onSettled();
      } catch (err) {
        setError(err instanceof Error ? err.message : fallbackMessage);
      } finally {
        inFlight.current = false;
        setSubmitting(false);
      }
    },
    [onSettled, target],
  );

  return { target, isOpen: target !== null, submitting, error, open, setOpen, run };
}

function toDateKey(year: number, cell: KeyboardCell): string {
  const month = String(cell.month + 1).padStart(2, "0");
  const day = String(cell.day).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Apply confirmed writes locally, then reload the server copy.
export function useEventMutations({
  year,
  eventApi,
  targetCalendar,
  dispatch,
  reconcile,
  focusYearGrid,
}: {
  year: number;
  eventApi: YearViewEventApi;
  /** Where quick-added events land. Null when no writable calendar is connected. */
  targetCalendar: CalendarSummary | null;
  dispatch: (action: YearViewAction) => void;
  reconcile: () => void;
  focusYearGrid: () => void;
}) {
  const onSettled = useCallback(() => {
    focusYearGrid();
    reconcile();
  }, [focusYearGrid, reconcile]);

  const create = useMutationSlot<KeyboardCell>(onSettled);
  const edit = useMutationSlot<CalendarEvent>(onSettled);
  const remove = useMutationSlot<CalendarEvent>(onSettled);

  const submitCreate = useCallback(
    (title: string) =>
      create.run(async (cell) => {
        if (targetCalendar === null) return;
        const event = await eventApi.createEvent(targetCalendar, {
          title,
          date: toDateKey(year, cell),
        });
        dispatch({ type: "EVENT_CREATED", event });
      }, "Failed to create event"),
    [create, dispatch, eventApi, targetCalendar, year],
  );

  const submitEdit = useCallback(
    (title: string) =>
      edit.run(async (event) => {
        await eventApi.updateEvent(event.calendarId, event.id, { title });
        dispatch({
          type: "EVENT_UPDATED",
          id: event.id,
          calendarId: event.calendarId,
          changes: { title },
        });
      }, "Failed to update event"),
    [dispatch, edit, eventApi],
  );

  const confirmDelete = useCallback(
    () =>
      remove.run(async (event) => {
        await eventApi.deleteEvent(event.calendarId, event.id);
        dispatch({ type: "EVENT_DELETED", id: event.id, calendarId: event.calendarId });
      }, "Failed to delete event"),
    [dispatch, eventApi, remove],
  );

  return {
    create,
    edit,
    remove,
    submitCreate,
    submitEdit,
    confirmDelete,
    /** True while any mutation dialog is up, so the grid can stand down its keys. */
    anyDialogOpen: create.isOpen || edit.isOpen || remove.isOpen,
  };
}
