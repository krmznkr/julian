import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Effect } from "effect";
import { useEventMutations } from "./use-event-mutations";
import type { CalendarEvent } from "@julian/domain";
import type { YearViewAction } from "@/components/year-view-reducer";
import type { YearViewEventApi } from "./year-view-ports";

const event: CalendarEvent = {
  id: "e1",
  calendarId: "c1",
  title: "Trip",
  start: "2026-09-12",
  end: "2026-09-13",
  allDay: true,
  isTimed: false,
};

describe("event mutations", () => {
  it("submits once and keeps the active dialog while the write is pending", async () => {
    let complete!: () => void;
    const pending = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const updateEvent = vi.fn<YearViewEventApi["updateEvent"]>(() => Effect.promise(() => pending));
    const dispatch = vi.fn<(action: YearViewAction) => void>();
    const { result } = renderHook(() =>
      useEventMutations({
        year: 2026,
        eventApi: {
          updateEvent,
          createEvent: vi.fn<YearViewEventApi["createEvent"]>(),
          deleteEvent: vi.fn<YearViewEventApi["deleteEvent"]>(),
        },
        targetCalendar: { id: "c1", summary: "Personal" },
        dispatch,
        reconcile: vi.fn<() => void>(),
        focusYearGrid: vi.fn<() => void>(),
      }),
    );
    act(() => result.current.edit.open(event));
    act(() => {
      result.current.submitEdit("Changed");
      result.current.submitEdit("Changed again");
      result.current.edit.setOpen(false);
      result.current.edit.open({ ...event, id: "e2" });
    });
    expect(updateEvent).toHaveBeenCalledTimes(1);
    expect(result.current.edit.target).toEqual(event);
    expect(result.current.edit.submitting).toBe(true);
    await act(async () => complete());
    expect(result.current.edit.isOpen).toBe(false);
    expect(dispatch).toHaveBeenCalledWith({
      type: "EVENT_UPDATED",
      id: "e1",
      calendarId: "c1",
      changes: { title: "Changed" },
    });
  });

  function render(eventApi: Partial<YearViewEventApi>) {
    const dispatch = vi.fn<(action: YearViewAction) => void>();
    const reconcile = vi.fn<() => void>();
    const view = renderHook(() =>
      useEventMutations({
        year: 2026,
        eventApi: {
          createEvent: vi.fn<YearViewEventApi["createEvent"]>(),
          updateEvent: vi.fn<YearViewEventApi["updateEvent"]>(),
          deleteEvent: vi.fn<YearViewEventApi["deleteEvent"]>(),
          ...eventApi,
        },
        targetCalendar: { id: "c1", summary: "Personal" },
        dispatch,
        reconcile,
        focusYearGrid: vi.fn<() => void>(),
      }),
    );
    return { ...view, dispatch, reconcile };
  }

  it("keeps the dialog open with the typed error message when a write fails", async () => {
    const { result, dispatch, reconcile } = render({
      deleteEvent: () =>
        Effect.fail({ _tag: "Google.ApiError", message: "Failed to delete event" }),
    });
    act(() => result.current.remove.open(event));
    await act(async () => result.current.confirmDelete());
    expect(result.current.remove.isOpen).toBe(true);
    expect(result.current.remove.error).toBe("Failed to delete event");
    expect(result.current.remove.submitting).toBe(false);
    expect(dispatch).not.toHaveBeenCalled();
    expect(reconcile).not.toHaveBeenCalled();
  });

  it("creates on the target calendar for the chosen day", async () => {
    const createEvent = vi.fn<YearViewEventApi["createEvent"]>((_calendar, input) =>
      Effect.succeed({ ...event, id: "new", title: input.title, start: input.date }),
    );
    const { result, dispatch, reconcile } = render({ createEvent });
    act(() => result.current.create.open({ month: 8, day: 3 }));
    await act(async () => result.current.submitCreate("Dinner"));
    expect(createEvent).toHaveBeenCalledWith(
      { id: "c1", summary: "Personal" },
      { title: "Dinner", date: "2026-09-03" },
    );
    expect(dispatch).toHaveBeenCalledWith({
      type: "EVENT_CREATED",
      event: { ...event, id: "new", title: "Dinner", start: "2026-09-03" },
    });
    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it("interrupts an in-flight write on unmount so it never dispatches", async () => {
    const interrupted = vi.fn<() => void>();
    let complete!: () => void;
    const pending = new Promise<void>((resolve) => {
      complete = resolve;
    });
    const { result, dispatch, unmount } = render({
      deleteEvent: () =>
        Effect.promise(() => pending).pipe(Effect.onInterrupt(() => Effect.sync(interrupted))),
    });
    act(() => result.current.remove.open(event));
    act(() => result.current.confirmDelete());
    unmount();
    expect(interrupted).toHaveBeenCalledTimes(1);
    await act(async () => complete());
    expect(dispatch).not.toHaveBeenCalled();
  });
});
