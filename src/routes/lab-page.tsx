import { SingleDayDisplay } from "@/components/year-view/single-day-display";
import { getTimedEventDayPlacement } from "@/components/year-view/day-timeline-placement";
import type { DaySquare } from "@/components/year-view/use-month-column";
import type { CalendarEvent, EventSegment } from "@/domain";

const YEAR = 2026;
const MONTH = 5; // 0-indexed = June
const DAY = 15;

function makeEvent(
  id: string,
  title: string,
  startIso: string,
  endIso: string,
  allDay: boolean,
  color: string,
): CalendarEvent {
  return {
    id,
    title,
    start: startIso,
    end: endIso,
    allDay,
    isTimed: !allDay,
    calendarId: "cal-1",
    calendarColor: color,
  };
}

function makeSegment(event: CalendarEvent): EventSegment {
  return {
    id: event.id,
    title: event.title,
    startDay: DAY,
    endDay: DAY,
    lane: 0,
    calendarColor: event.calendarColor ?? null,
    calendarId: event.calendarId,
    allDay: event.allDay,
    isTimed: event.isTimed,
  };
}

function makeSquare(event: CalendarEvent): DaySquare {
  const timedPlacement = event.allDay ? null : getTimedEventDayPlacement(event, YEAR, MONTH, DAY);
  return { segment: makeSegment(event), event, allDay: event.allDay, timedPlacement };
}

function d(h: number, m = 0) {
  return `${YEAR}-${String(MONTH + 1).padStart(2, "0")}-${String(DAY).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
}

const CASES: { label: string; description: string; squares: DaySquare[] }[] = [
  { label: "Empty", description: "No events", squares: [] },
  {
    label: "Single timed",
    description: "One block on the 24h timeline",
    squares: [makeSquare(makeEvent("t1", "Standup", d(9), d(9, 30), false, "#4285F4"))],
  },
  {
    label: "Two timed",
    description: "Two non-overlapping blocks",
    squares: [
      makeSquare(makeEvent("t2a", "Standup", d(9), d(9, 30), false, "#4285F4")),
      makeSquare(makeEvent("t2b", "Lunch", d(12), d(13), false, "#0F9D58")),
    ],
  },
  {
    label: "Overlapping",
    description: "Three overlapping blocks",
    squares: [
      makeSquare(makeEvent("t3a", "Meeting A", d(10), d(12), false, "#4285F4")),
      makeSquare(makeEvent("t3b", "Meeting B", d(10, 30), d(11, 30), false, "#DB4437")),
      makeSquare(makeEvent("t3c", "Call", d(11), d(12), false, "#F4B400")),
    ],
  },
  {
    label: "Single all-day",
    description: "Full-width hollow outline spanning the cell",
    squares: [makeSquare(makeEvent("a1", "Vacation", d(0), d(0), true, "#4285F4"))],
  },
  {
    label: "Many all-day",
    description: "Stacked full-width outlines",
    squares: [
      makeSquare(makeEvent("a2a", "Vacation", d(0), d(0), true, "#4285F4")),
      makeSquare(makeEvent("a2b", "OOO", d(0), d(0), true, "#DB4437")),
      makeSquare(makeEvent("a2c", "Holiday", d(0), d(0), true, "#0F9D58")),
      makeSquare(makeEvent("a2d", "Conference", d(0), d(0), true, "#F4B400")),
    ],
  },
  {
    label: "Mix",
    description: "Full-width all-day outline + partial timed blocks",
    squares: [
      makeSquare(makeEvent("m1", "OOO", d(0), d(0), true, "#DB4437")),
      makeSquare(makeEvent("m2", "Standup", d(9), d(9, 30), false, "#4285F4")),
      makeSquare(makeEvent("m3", "Lunch", d(12), d(13), false, "#0F9D58")),
    ],
  },
  {
    label: "Dense",
    description: "Stacked all-day outlines + partial timed blocks",
    squares: [
      makeSquare(makeEvent("d1", "Vacation", d(0), d(0), true, "#4285F4")),
      makeSquare(makeEvent("d2", "OOO", d(0), d(0), true, "#DB4437")),
      makeSquare(makeEvent("d3", "Standup", d(9), d(9, 30), false, "#F4B400")),
      makeSquare(makeEvent("d4", "1:1", d(10), d(11), false, "#0F9D58")),
      makeSquare(makeEvent("d5", "Review", d(11), d(12, 30), false, "#AB47BC")),
      makeSquare(makeEvent("d6", "Lunch", d(12), d(13), false, "#00ACC1")),
    ],
  },
  {
    label: "Long title",
    description: "All-day chip truncates; partial timed on timeline",
    squares: [
      makeSquare(
        makeEvent("l1", "Very Long Event Title That Will Truncate", d(0), d(0), true, "#4285F4"),
      ),
      makeSquare(
        makeEvent("l2", "Another Extremely Long Meeting Name Here", d(10), d(12), false, "#DB4437"),
      ),
    ],
  },
  {
    label: "Edge times",
    description: "Blocks at start and end of day",
    squares: [
      makeSquare(makeEvent("e1", "Midnight", d(0), d(0, 30), false, "#4285F4")),
      makeSquare(makeEvent("e2", "Late night", d(23), d(23, 59), false, "#DB4437")),
    ],
  },
  {
    label: "Full-day timed",
    description: "Hollow outline spanning 24h — partial blocks visible inside",
    squares: [
      makeSquare(makeEvent("f1", "All-day meeting", d(0), d(23, 59), false, "#4285F4")),
      makeSquare(makeEvent("f2", "Standup", d(9), d(9, 30), false, "#0F9D58")),
    ],
  },
];

function CaseCard({ label, description, squares }: (typeof CASES)[number]) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[11px] font-medium text-foreground">{label}</div>
      <div
        className="flex h-[30px] min-w-0 items-stretch rounded-md border border-border/60 bg-card"
        style={{ width: 220 }}
      >
        <SingleDayDisplay year={YEAR} month={MONTH} day={DAY} squares={squares} />
      </div>
      <div className="text-[10px] text-muted-foreground">{description}</div>
    </div>
  );
}

export function LabPage() {
  return (
    <main className="min-h-dvh bg-background p-8">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-foreground">Day cell lab</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Full cell width is 24 hours. All-day and full-day timed events span the entire cell as
          hollow outlines; partial timed blocks are borderless color fills showing busyness.
        </p>
      </div>
      <div className="flex flex-wrap gap-6">
        {CASES.map((c) => (
          <CaseCard key={c.label} {...c} />
        ))}
      </div>
    </main>
  );
}
