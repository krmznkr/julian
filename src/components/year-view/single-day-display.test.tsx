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
  it("shows a timed appointment with its time instead of hiding it", () => {
    render(<SingleDayDisplay squares={[square(timed)]} />);
    expect(screen.getByRole("button", { name: /Dentist,.*9/ })).toBeInTheDocument();
  });

  it("makes additional events discoverable with a count", () => {
    render(
      <SingleDayDisplay
        squares={[
          square(timed),
          square({ ...timed, id: "two", title: "Lunch" }),
          square({ ...timed, id: "three", title: "Call" }),
        ]}
      />,
    );
    expect(screen.getByRole("button", { name: "Show all 3 single-day events" })).toHaveTextContent(
      "+2",
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
