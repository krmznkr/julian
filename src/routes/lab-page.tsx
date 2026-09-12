import { useMemo } from "react";
import { SingleDayDisplay } from "@/components/year-view/single-day-display";
import MonthColumn from "@/components/year-view/month-column";
import { YearViewSharedDataProvider } from "@/components/year-view/year-view-context";
import { buildEventKey, buildMonthSegments, type CalendarEvent } from "@/domain";

const calendar = { id: "sample", summary: "Sample", backgroundColor: "#4285f4" };
const sharedData = {
  calendars: [calendar],
  monthNames: Array.from({ length: 12 }, (_, month) =>
    new Date(2026, month, 1).toLocaleDateString(undefined, { month: "long" }),
  ),
};
const noop = () => {};
const makeEvent = (
  id: string,
  title: string,
  start: string,
  end: string,
  allDay = true,
): CalendarEvent => ({
  id,
  title,
  start,
  end,
  allDay,
  isTimed: !allDay,
  calendarId: calendar.id,
  calendarColor: calendar.backgroundColor,
});
const cases = [
  { label: "All-day", events: [makeEvent("a", "Holiday", "2026-06-15", "2026-06-16")] },
  {
    label: "Timed · dialog only",
    events: [makeEvent("t", "Dentist", "2026-06-15T09:00:00", "2026-06-15T09:30:00", false)],
  },
  {
    label: "Ends at midnight · dialog only",
    events: [makeEvent("m", "Late shift", "2026-06-15T22:00:00", "2026-06-16T00:00:00", false)],
  },
  {
    label: "Busy timed day · dialog only",
    events: Array.from({ length: 6 }, (_, i) =>
      makeEvent(
        `busy-${i}`,
        `Appointment ${i + 1}`,
        `2026-06-15T${String(9 + i).padStart(2, "0")}:00:00`,
        `2026-06-15T${String(10 + i).padStart(2, "0")}:00:00`,
        false,
      ),
    ),
  },
];
const spanning = [
  makeEvent("trip", "Trip across months", "2026-05-31", "2026-06-03"),
  makeEvent("night", "Overnight flight", "2026-05-31T23:30:00", "2026-06-01T02:00:00", false),
  ...cases.flatMap((item) => item.events),
];

export function LabPage() {
  const months = useMemo(() => buildMonthSegments(spanning, 2026), []);
  const events = useMemo(
    () => new Map(spanning.map((event) => [buildEventKey(event.id, event.calendarId), event])),
    [],
  );
  return (
    <main className="min-h-dvh bg-background p-6 text-foreground">
      <h1 className="text-xl font-semibold">Event display examples</h1>
      <p className="my-3 text-sm text-muted-foreground">
        Only all-day events appear in cells. Timed events remain in day details. All-day multi-day
        events keep their bar across month boundaries, and midnight end times do not occupy the next
        day.
      </p>
      <div className="my-6 flex flex-wrap gap-6">
        {cases.map(({ label, events: items }) => {
          const segments = buildMonthSegments(items, 2026)[5].segments;
          const squares = items.map((event) => ({
            event,
            allDay: event.allDay,
            segment: segments.find(
              (segment) => segment.id === buildEventKey(event.id, event.calendarId),
            )!,
          }));
          return (
            <section key={label}>
              <h2 className="mb-2 text-sm">{label}</h2>
              {[120, 220].map((width) => (
                <div key={width} className="mb-2 h-[30px] border border-border" style={{ width }}>
                  <SingleDayDisplay squares={squares} />
                </div>
              ))}
            </section>
          );
        })}
      </div>
      <YearViewSharedDataProvider value={sharedData}>
        <div className="flex gap-1 overflow-x-auto">
          {[4, 5].map((month) => (
            <section key={month}>
              <h2 className="py-2 text-sm">{sharedData.monthNames[month]}</h2>
              <MonthColumn
                month={months[month]}
                events={events}
                year={2026}
                todayDay={1}
                todayMonth={0}
                isCurrentYear={false}
                rowHeight={30}
                keyboardFocusedDay={null}
                keyboardDialogDay={null}
                dialogActiveKey={undefined}
                onDialogActiveKeyChange={noop}
              />
            </section>
          ))}
        </div>
      </YearViewSharedDataProvider>
    </main>
  );
}
