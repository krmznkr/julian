import { useEffect, useMemo, useState } from "react";
import { Briefcase, Gift, HeartPulse, Plane, type LucideIcon } from "lucide-react";

// A self-contained, non-interactive preview of the year view. It renders the
// same "months as columns, days as rows, multi-day events as vertical bars"
// idea as the real app, driven by curated dummy data, and auto-plays a short
// scenario that highlights events one after another so first-time visitors can
// see what Julian is for without signing in.

type CalendarId = "travel" | "work" | "personal" | "health";

type DemoCalendar = {
  readonly id: CalendarId;
  readonly name: string;
  readonly color: string;
  readonly icon: LucideIcon;
};

const CALENDARS: readonly DemoCalendar[] = [
  { id: "travel", name: "Travel", color: "#3b82f6", icon: Plane },
  { id: "work", name: "Work", color: "#8b5cf6", icon: Briefcase },
  { id: "personal", name: "Personal", color: "#10b981", icon: Gift },
  { id: "health", name: "Health", color: "#f43f5e", icon: HeartPulse },
];

const CALENDAR_BY_ID: Record<CalendarId, DemoCalendar> = Object.fromEntries(
  CALENDARS.map((calendar) => [calendar.id, calendar]),
) as Record<CalendarId, DemoCalendar>;

type DemoEvent = {
  readonly id: string;
  readonly title: string;
  readonly cal: CalendarId;
  // 0-indexed month, 1-indexed day; end is inclusive.
  readonly startMonth: number;
  readonly startDay: number;
  readonly endMonth: number;
  readonly endDay: number;
};

const EVENTS: readonly DemoEvent[] = [
  {
    id: "ski",
    title: "Ski trip · the Alps",
    cal: "travel",
    startMonth: 0,
    startDay: 12,
    endMonth: 0,
    endDay: 19,
  },
  {
    id: "launch-prep",
    title: "Launch prep",
    cal: "work",
    startMonth: 1,
    startDay: 3,
    endMonth: 1,
    endDay: 14,
  },
  {
    id: "launch",
    title: "Product launch",
    cal: "work",
    startMonth: 1,
    startDay: 18,
    endMonth: 1,
    endDay: 18,
  },
  {
    id: "japan",
    title: "Cherry blossoms · Japan",
    cal: "travel",
    startMonth: 2,
    startDay: 22,
    endMonth: 3,
    endDay: 2,
  },
  {
    id: "training",
    title: "Marathon training",
    cal: "health",
    startMonth: 3,
    startDay: 6,
    endMonth: 4,
    endDay: 24,
  },
  {
    id: "marathon",
    title: "City marathon",
    cal: "health",
    startMonth: 4,
    startDay: 25,
    endMonth: 4,
    endDay: 25,
  },
  {
    id: "conf",
    title: "Design conference",
    cal: "work",
    startMonth: 5,
    startDay: 11,
    endMonth: 5,
    endDay: 13,
  },
  {
    id: "portugal",
    title: "Summer in Portugal",
    cal: "travel",
    startMonth: 6,
    startDay: 14,
    endMonth: 7,
    endDay: 1,
  },
  {
    id: "birthday",
    title: "Mom's birthday",
    cal: "personal",
    startMonth: 7,
    startDay: 9,
    endMonth: 7,
    endDay: 9,
  },
  {
    id: "school",
    title: "Back to school",
    cal: "personal",
    startMonth: 8,
    startDay: 1,
    endMonth: 8,
    endDay: 1,
  },
  {
    id: "planning",
    title: "Q4 planning",
    cal: "work",
    startMonth: 9,
    startDay: 6,
    endMonth: 9,
    endDay: 10,
  },
  {
    id: "roadtrip",
    title: "Road trip · the coast",
    cal: "travel",
    startMonth: 9,
    startDay: 18,
    endMonth: 9,
    endDay: 26,
  },
  {
    id: "thanksgiving",
    title: "Thanksgiving break",
    cal: "personal",
    startMonth: 10,
    startDay: 26,
    endMonth: 10,
    endDay: 29,
  },
  {
    id: "holidays",
    title: "Holidays",
    cal: "personal",
    startMonth: 11,
    startDay: 21,
    endMonth: 11,
    endDay: 31,
  },
];

const EVENT_BY_ID: Record<string, DemoEvent> = Object.fromEntries(
  EVENTS.map((event) => [event.id, event]),
);

// Ambient season bands rendered faintly behind the events, spanning many months
// so the whole year reads at a glance.
type Season = {
  readonly startMonth: number;
  readonly startDay: number;
  readonly endMonth: number;
  readonly endDay: number;
  readonly color: string;
};

const SEASONS: readonly Season[] = [
  { startMonth: 0, startDay: 1, endMonth: 2, endDay: 19, color: "#60a5fa" },
  { startMonth: 2, startDay: 20, endMonth: 5, endDay: 20, color: "#34d399" },
  { startMonth: 5, startDay: 21, endMonth: 8, endDay: 21, color: "#fbbf24" },
  { startMonth: 8, startDay: 22, endMonth: 11, endDay: 20, color: "#fb923c" },
  { startMonth: 11, startDay: 21, endMonth: 11, endDay: 31, color: "#60a5fa" },
];

// The order in which the auto-play scenario highlights events.
const STORY: readonly string[] = ["ski", "japan", "marathon", "portugal", "planning", "holidays"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MARKERS = [1, 8, 15, 22, 29];
const GRID_DAYS = 31;
const YEAR = new Date().getFullYear();
const DAYS_IN_MONTH = Array.from({ length: 12 }, (_, month) =>
  new Date(YEAR, month + 1, 0).getDate(),
);

type Span = { startMonth: number; startDay: number; endMonth: number; endDay: number };

// Clip a multi-month span to the portion that falls inside `month`, returning
// the top/height (as a fraction of the 31-row grid) or null if it doesn't touch.
function clipToMonth(span: Span, month: number): { startDay: number; endDay: number } | null {
  if (month < span.startMonth || month > span.endMonth) return null;
  const startDay = month === span.startMonth ? span.startDay : 1;
  const endDay = month === span.endMonth ? span.endDay : DAYS_IN_MONTH[month];
  return { startDay, endDay };
}

type PlacedBar = {
  readonly event: DemoEvent;
  readonly startDay: number;
  readonly endDay: number;
  readonly lane: number;
};

type MonthLayout = { readonly bars: readonly PlacedBar[]; readonly laneCount: number };

// Greedy, allocation-free-ish lane packing so overlapping events sit side by
// side instead of on top of each other. Kept immutable to satisfy the repo's
// functional lint rules.
function packMonth(month: number): MonthLayout {
  const unsorted = EVENTS.flatMap((event) => {
    const clip = clipToMonth(event, month);
    return clip ? [{ event, startDay: clip.startDay, endDay: clip.endDay }] : [];
  });
  const clipped = [...unsorted].sort((a, b) => a.startDay - b.startDay || b.endDay - a.endDay);

  const initial: { laneEnds: readonly number[]; bars: readonly PlacedBar[] } = {
    laneEnds: [],
    bars: [],
  };
  const { laneEnds, bars } = clipped.reduce((acc, seg) => {
    const free = acc.laneEnds.findIndex((end) => end < seg.startDay);
    const lane = free === -1 ? acc.laneEnds.length : free;
    const laneEnds =
      free === -1
        ? [...acc.laneEnds, seg.endDay]
        : acc.laneEnds.map((end, index) => (index === lane ? seg.endDay : end));
    return { laneEnds, bars: [...acc.bars, { ...seg, lane }] };
  }, initial);

  return { bars, laneCount: Math.max(1, laneEnds.length) };
}

function pct(value: number): string {
  return `${(value / GRID_DAYS) * 100}%`;
}

function formatRange(event: DemoEvent): string {
  const start = `${MONTHS[event.startMonth]} ${event.startDay}`;
  if (event.startMonth === event.endMonth && event.startDay === event.endDay) return start;
  return `${start} – ${MONTHS[event.endMonth]} ${event.endDay}`;
}

function MonthColumn({ month, activeId }: { month: number; activeId: string }) {
  const { bars, laneCount } = useMemo(() => packMonth(month), [month]);

  return (
    <div className="relative flex-1 border-r border-border/60 last:border-r-0">
      {/* faint per-day rows */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(100%/31 - 1px), var(--color-border) calc(100%/31 - 1px), var(--color-border) calc(100%/31))`,
          opacity: 0.4,
        }}
      />

      {/* ambient seasons */}
      {SEASONS.map((season, index) => {
        const clip = clipToMonth(season, month);
        if (!clip) return null;
        return (
          <div
            key={index}
            aria-hidden
            className="absolute inset-x-0"
            style={{
              top: pct(clip.startDay - 1),
              height: pct(clip.endDay - clip.startDay + 1),
              backgroundColor: `${season.color}1c`,
            }}
          />
        );
      })}

      {/* events */}
      {bars.map((bar) => {
        const calendar = CALENDAR_BY_ID[bar.event.cal];
        const isActive = bar.event.id === activeId;
        const single = bar.startDay === bar.endDay;
        return (
          <div
            key={`${bar.event.id}-${bar.startDay}`}
            className="absolute rounded-[3px] transition-all duration-300"
            style={{
              top: pct(bar.startDay - 1),
              height: `calc(${pct(bar.endDay - bar.startDay + 1)} - 2px)`,
              left: `calc(${(bar.lane / laneCount) * 100}% + 1px)`,
              width: `calc(${(1 / laneCount) * 100}% - 3px)`,
              backgroundColor: calendar.color,
              opacity: isActive ? 1 : 0.85,
              boxShadow: isActive
                ? `0 0 0 2px var(--color-background), 0 0 0 3.5px ${calendar.color}`
                : "none",
              transform: isActive ? "scale(1.06)" : "none",
              zIndex: isActive ? 10 : 1,
              minHeight: single ? "5px" : undefined,
            }}
            title={`${bar.event.title} · ${formatRange(bar.event)}`}
          />
        );
      })}
    </div>
  );
}

export function LandingDemo() {
  const [activeId, setActiveId] = useState<string>(STORY[0]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return undefined;
    const timer = window.setInterval(() => {
      setActiveId((prev) => {
        const index = STORY.indexOf(prev);
        return STORY[(index + 1) % STORY.length];
      });
    }, 2600);
    return () => window.clearInterval(timer);
  }, [paused]);

  const active = EVENT_BY_ID[activeId] ?? EVENTS[0];
  const activeCalendar = CALENDAR_BY_ID[active.cal];
  const ActiveIcon = activeCalendar.icon;

  return (
    <div
      className="rounded-2xl border border-border bg-card p-4 shadow-2xl shadow-black/5 sm:p-5"
      onMouseLeave={() => setPaused(false)}
      aria-label={`Preview of ${YEAR} in Julian, with sample travel, work, personal, and health events`}
      role="img"
    >
      {/* header: window chrome + legend */}
      <div className="mb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="flex gap-1.5" aria-hidden>
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
          </span>
          <span className="text-xs font-medium text-muted-foreground">Julian · {YEAR}</span>
        </div>
        <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 sm:flex" aria-hidden>
          {CALENDARS.map((calendar) => (
            <span key={calendar.id} className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: calendar.color }} />
              <span className="text-[11px] text-muted-foreground">{calendar.name}</span>
            </span>
          ))}
        </div>
      </div>

      {/* the year board */}
      <div className="flex gap-1">
        {/* day gutter */}
        <div className="relative hidden w-5 shrink-0 sm:block" aria-hidden>
          <div className="h-4" />
          <div className="relative h-[240px] sm:h-[300px] lg:h-[340px]">
            {DAY_MARKERS.map((day) => (
              <span
                key={day}
                className="absolute right-1 -translate-y-1/2 text-[9px] tabular-nums text-muted-foreground/70"
                style={{ top: pct(day - 0.5) }}
              >
                {day}
              </span>
            ))}
          </div>
        </div>

        {/* months */}
        <div className="flex-1 overflow-hidden rounded-lg border border-border/60 bg-background">
          <div className="flex">
            {MONTHS.map((name) => (
              <div
                key={name}
                className="flex-1 border-r border-border/60 py-1 text-center text-[10px] font-medium text-muted-foreground last:border-r-0 sm:text-[11px]"
              >
                {name}
              </div>
            ))}
          </div>
          <div className="flex h-[240px] border-t border-border/60 sm:h-[300px] lg:h-[340px]">
            {MONTHS.map((_, month) => (
              <MonthColumn key={month} month={month} activeId={activeId} />
            ))}
          </div>
        </div>
      </div>

      {/* narrated caption */}
      <div className="mt-3 flex items-center gap-3" aria-live="polite">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `${activeCalendar.color}1f`, color: activeCalendar.color }}
        >
          <ActiveIcon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">{active.title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {formatRange(active)} · {activeCalendar.name}
          </p>
        </div>
        <span className="ml-auto hidden items-center gap-1.5 sm:flex" aria-hidden>
          {STORY.map((id) => (
            <button
              key={id}
              type="button"
              onMouseEnter={() => {
                setActiveId(id);
                setPaused(true);
              }}
              onFocus={() => {
                setActiveId(id);
                setPaused(true);
              }}
              onClick={() => {
                setActiveId(id);
                setPaused(true);
              }}
              aria-label={EVENT_BY_ID[id]?.title ?? id}
              className="h-1.5 rounded-full transition-all"
              style={{
                width: id === activeId ? "18px" : "6px",
                backgroundColor:
                  id === activeId ? activeCalendar.color : "var(--color-muted-foreground)",
                opacity: id === activeId ? 1 : 0.35,
              }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
