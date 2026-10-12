import { useMemo } from "react";
import MonthColumn from "@/components/year-view/month-column";
import { TooltipProvider } from "@/components/tooltip";
import { YearViewSharedDataProvider } from "@/components/year-view/year-view-context";
import { buildEventKey, buildMonthSegments, type CalendarEvent } from "@/domain";

const calendar = {
  id: "sample",
  summary: "Sample calendar",
  backgroundColor: "#38a66f",
  accessRole: "owner" as const,
};

const sampleEvents: CalendarEvent[] = [
  {
    id: "paris",
    title: "🇫🇷 Paris & Lille · vacation",
    start: "2026-09-17",
    end: "2026-09-27",
    allDay: true,
    isTimed: false,
    calendarId: calendar.id,
    calendarColor: "#38a66f",
  },
  {
    id: "moxy",
    title: "🏨 Moxy CDG · evening arrival",
    start: "2026-09-18T18:30:00",
    end: "2026-09-21T09:00:00",
    allDay: false,
    isTimed: true,
    calendarId: calendar.id,
    calendarColor: "#9a73df",
  },
  {
    id: "clamart",
    title: "🏨 Clamart · Residence Service",
    start: "2026-09-18",
    end: "2026-09-22",
    allDay: true,
    isTimed: false,
    calendarId: calendar.id,
    calendarColor: "#58b98a",
  },
  {
    id: "office",
    title: "Out of office",
    start: "2026-09-20",
    end: "2026-09-25",
    allDay: true,
    isTimed: false,
    calendarId: calendar.id,
    calendarColor: "#ed7658",
  },
  {
    id: "leave",
    title: "🌴 Annual leave",
    start: "2026-09-20",
    end: "2026-09-25",
    allDay: true,
    isTimed: false,
    calendarId: calendar.id,
    calendarColor: "#78b96d",
  },
  {
    id: "lille",
    title: "🏨 Lille · Montempô Gares",
    start: "2026-09-21",
    end: "2026-09-25",
    allDay: true,
    isTimed: false,
    calendarId: calendar.id,
    calendarColor: "#49a97b",
  },
  {
    id: "train",
    title: "Train to Lille · 14:08",
    start: "2026-09-21",
    end: "2026-09-22",
    allDay: true,
    isTimed: false,
    calendarId: calendar.id,
    calendarColor: "#9a73df",
  },
];

const noop = () => {};

export function LabPage() {
  const month = useMemo(() => buildMonthSegments(sampleEvents, 2026)[8], []);
  const eventMap = useMemo(
    () =>
      new Map(
        sampleEvents.map((event) => [buildEventKey(event.id, event.calendarId), event] as const),
      ),
    [],
  );
  const sharedData = useMemo(
    () => ({
      calendars: [calendar],
      monthNames: Array.from({ length: 12 }, (_, index) =>
        new Date(2026, index, 1).toLocaleDateString(undefined, { month: "long" }),
      ),
    }),
    [],
  );

  return (
    <TooltipProvider>
      <YearViewSharedDataProvider value={sharedData}>
        <main className="min-h-dvh bg-muted/30 px-6 py-8 text-foreground">
          <header className="mx-auto mb-6 max-w-4xl">
            <div className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Production component preview
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              Google-style overlap columns
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              All visible events use the same collision lanes. Purple begins at 18:30 on September
              18 and ends at 09:00 on September 21. Nothing is replaced by a hidden-event count.
            </p>
          </header>
          <section className="mx-auto max-w-4xl overflow-x-auto rounded-xl border border-border bg-background p-5 shadow-sm">
            <div className="mb-2 w-[var(--month-col-width)] border-b border-border pb-2 text-sm font-semibold">
              September
            </div>
            <MonthColumn
              month={month}
              events={eventMap}
              year={2026}
              todayDay={17}
              todayMonth={8}
              isCurrentYear={false}
              rowHeight={30}
              keyboardFocusedDay={null}
              keyboardDialogDay={null}
              dialogActiveKey={undefined}
              onDialogActiveKeyChange={noop}
            />
          </section>
        </main>
      </YearViewSharedDataProvider>
    </TooltipProvider>
  );
}
