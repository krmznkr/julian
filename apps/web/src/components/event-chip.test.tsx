import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import EventChip from "./event-chip";
import { buildMonthSegments, type CalendarEvent } from "@julian/domain";

afterEach(cleanup);

const overnight: CalendarEvent = {
  id: "overnight",
  calendarId: "calendar",
  calendarColor: "#0f9d58",
  title: "Home and wind down",
  start: "2026-10-11T23:34:00",
  end: "2026-10-12T00:15:00",
  allDay: false,
  isTimed: true,
};

describe("timed year-view event chips", () => {
  it.each([
    { name: "a short overnight event", event: overnight, month: 9, rows: "11 / 13" },
    {
      name: "the first part across a month boundary",
      event: { ...overnight, start: "2026-10-31T23:34:00", end: "2026-11-01T00:15:00" },
      month: 9,
      rows: "31 / 32",
    },
    {
      name: "the final part across a month boundary",
      event: { ...overnight, start: "2026-10-31T23:34:00", end: "2026-11-01T00:15:00" },
      month: 10,
      rows: "1 / 2",
    },
  ])("keeps $name at calendar-day resolution", ({ event, month, rows }) => {
    const segment = buildMonthSegments([event], 2026)[month].segments[0];
    render(
      <EventChip
        segment={segment}
        event={event}
        calendars={[]}
        onClick={() => undefined}
        showTooltip={false}
      />,
    );

    const chip = screen.getByRole("button", { name: /Home and wind down/ });
    expect(chip.style.gridRow).toBe(rows);
    expect(chip.style.marginTop).toBe("");
    expect(chip.style.marginBottom).toBe("");
    expect(chip).toHaveTextContent(event.title);
    expect(chip).toHaveAttribute("title", expect.stringContaining("11:34 PM – 12:15 AM"));
  });
});
