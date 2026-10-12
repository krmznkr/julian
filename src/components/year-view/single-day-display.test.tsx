import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SingleDayDisplay } from "./single-day-display";
import { buildMonthSegments, type CalendarEvent } from "@/domain";
import { useChipStyle } from "@/components/use-event-chip";
import { renderHook } from "@testing-library/react";

const timed: CalendarEvent = {
  id: "meeting",
  calendarId: "cal",
  title: "Dentist",
  start: "2026-06-15T09:00:00",
  end: "2026-06-15T09:30:00",
  allDay: false,
  isTimed: true,
};
const square = (event: CalendarEvent) => ({
  event,
  allDay: event.allDay,
  segment: buildMonthSegments([event], 2026)[5].segments[0],
});

describe("single-day display", () => {
  it("does not show a timed appointment in the cell", () => {
    render(<SingleDayDisplay squares={[square(timed)]} />);
    expect(screen.queryByRole("button", { name: /Dentist/ })).not.toBeInTheDocument();
  });

  it("shows and counts only all-day events", () => {
    const allDay = {
      ...timed,
      id: "holiday",
      title: "Holiday",
      start: "2026-06-15",
      end: "2026-06-16",
      allDay: true,
      isTimed: false,
    };
    render(
      <SingleDayDisplay
        squares={[
          square(timed),
          square(allDay),
          square({ ...allDay, id: "two", title: "Vacation" }),
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Holiday, All day" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show all 2 all-day events" })).toHaveTextContent(
      "+1",
    );
  });

  it("places lanes beyond sixteen without spanning the whole month", () => {
    const segment = { ...square(timed).segment, startDay: 1, endDay: 3, lane: 17 };
    const { result } = renderHook(() =>
      useChipStyle(segment, undefined, undefined, 17, false, "chip"),
    );
    expect(result.current.chipStyle).toMatchObject({ gridRow: "1 / 4", gridColumn: "17 / 18" });
  });
});
