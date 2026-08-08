import { useCallback, useState } from "react";
import type { YearViewAction } from "@/components/year-view-reducer";
import type { KeyboardCell } from "@/components/year-view/year-grid-keyboard";
import type { YearViewEventApi } from "@/components/year-view/year-view-ports";
import type { CalendarEvent, CalendarSummary } from "@/domain";

/**
 * One create / edit / delete flow: which record the dialog is acting on, whether
 * the request is in flight, and what went wrong. The three flows are identical
 * apart from the call they make, so they share this shape instead of repeating
 * the submitting / error / close / refocus dance three times.
 */
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

  const open = useCallback((next: T) => {
    setError(null);
    setTarget(next);
  }, []);

  const setOpen = useCallback(
    (isOpen: boolean) => {
      if (isOpen) return;
      setTarget(null);
      setError(null);
      onSettled();
    },
    [onSettled],
  );

  const run = useCallback(
    async (perform: (current: T) => Promise<void>, fallbackMessage: string) => {
      if (target === null) return;
      setSubmitting(true);
      setError(null);
      try {
        await perform(target);
        setTarget(null);
        onSettled();
      } catch (err) {
        setError(err instanceof Error ? err.message : fallbackMessage);
      } finally {
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

/**
 * The year view's three write paths. Each one updates local state optimistically
 * so the grid reacts immediately, then asks the caller to reconcile against the
 * source so colours and ordering match the stored copy.
 */
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
        dispatch({ type: "EVENT_UPDATED", id: event.id, changes: { title } });
      }, "Failed to update event"),
    [dispatch, edit, eventApi],
  );

  const confirmDelete = useCallback(
    () =>
      remove.run(async (event) => {
        await eventApi.deleteEvent(event.calendarId, event.id);
        dispatch({ type: "EVENT_DELETED", id: event.id });
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
