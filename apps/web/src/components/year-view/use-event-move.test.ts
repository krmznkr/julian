import { act, renderHook } from "@testing-library/react";
import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "@julian/domain";
import type { YearViewAction } from "@/components/year-view-reducer";
import type { YearViewEventApi } from "./year-view-ports";
import { canMoveEvent, moveAllDayDates, useEventMove } from "./use-event-move";

const trip: CalendarEvent = {
  id: "e1",
  calendarId: "c1",
  title: "Trip",
  start: "2026-03-30",
  end: "2026-04-02",
  allDay: true,
  isTimed: false,
};

describe("moveAllDayDates", () => {
  it("keeps the length of the event across a month boundary", () => {
    expect(moveAllDayDates(trip, "2026-02-27")).toEqual({ start: "2026-02-27", end: "2026-03-02" });
  });

  it("keeps a one-day event one day long, across the DST change", () => {
    expect(moveAllDayDates({ start: "2026-03-28", end: "2026-03-29" }, "2026-03-29")).toEqual({
      start: "2026-03-29",
      end: "2026-03-30",
    });
  });
});

describe("canMoveEvent", () => {
  it("allows only writable all-day events", () => {
    expect(canMoveEvent(trip, () => true)).toBe(true);
    expect(canMoveEvent(trip, () => false)).toBe(false);
    expect(canMoveEvent({ ...trip, allDay: false }, () => true)).toBe(false);
  });
});

describe("useEventMove", () => {
  function setup(moveEvent: YearViewEventApi["moveEvent"]) {
    const dispatch = vi.fn<(action: YearViewAction) => void>();
    const eventApi: YearViewEventApi = {
      createEvent: vi.fn<YearViewEventApi["createEvent"]>(),
      updateEvent: vi.fn<YearViewEventApi["updateEvent"]>(),
      moveEvent: vi.fn<YearViewEventApi["moveEvent"]>(moveEvent),
      deleteEvent: vi.fn<YearViewEventApi["deleteEvent"]>(),
    };
    const view = renderHook(() => useEventMove({ eventApi, dispatch }));
    return { dispatch, eventApi, view };
  }

  const updated = (start: string, end: string): YearViewAction => ({
    type: "EVENT_UPDATED",
    id: "e1",
    calendarId: "c1",
    changes: { start, end },
  });

  it("shows the move at once and keeps it when the write succeeds", async () => {
    const { dispatch, eventApi, view } = setup(() => Effect.void);
    await act(async () => view.result.current.move(trip, "2026-05-01"));
    expect(eventApi.moveEvent).toHaveBeenCalledWith("c1", "e1", {
      start: "2026-05-01",
      end: "2026-05-04",
    });
    expect(dispatch.mock.calls).toEqual([[updated("2026-05-01", "2026-05-04")]]);
    expect(view.result.current.error).toBeNull();
  });

  it("puts the event back and reports why when the write fails", async () => {
    const { dispatch, view } = setup(() =>
      Effect.fail({ _tag: "Google.ApiError", message: "Forbidden" }),
    );
    await act(async () => view.result.current.move(trip, "2026-05-01"));
    expect(dispatch.mock.calls).toEqual([
      [updated("2026-05-01", "2026-05-04")],
      [updated("2026-03-30", "2026-04-02")],
    ]);
    expect(view.result.current.error).toBe("Could not move “Trip”: Forbidden");
    act(() => view.result.current.dismissError());
    expect(view.result.current.error).toBeNull();
  });

  it("does nothing when dropped on its own day", () => {
    const { dispatch, eventApi, view } = setup(() => Effect.void);
    act(() => view.result.current.move(trip, "2026-03-30"));
    expect(dispatch).not.toHaveBeenCalled();
    expect(eventApi.moveEvent).not.toHaveBeenCalled();
  });

  it("rolls back a write still pending when the view unmounts", () => {
    const { dispatch, view } = setup(() => Effect.never);
    act(() => view.result.current.move(trip, "2026-05-01"));
    view.unmount();
    expect(dispatch).toHaveBeenLastCalledWith(updated("2026-03-30", "2026-04-02"));
  });

  it("tracks the event the keyboard move dialog is for", () => {
    const { view } = setup(() => Effect.void);
    act(() => view.result.current.open(trip));
    expect(view.result.current.target).toBe(trip);
    act(() => view.result.current.close());
    expect(view.result.current.target).toBeNull();
  });
});
