import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useEventMutations } from "./use-event-mutations";
import type { CalendarEvent } from "@/domain";
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
    const updateEvent = vi.fn<YearViewEventApi["updateEvent"]>(() => pending);
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
      void result.current.submitEdit("Changed");
      void result.current.submitEdit("Changed again");
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
});
