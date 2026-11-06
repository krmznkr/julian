// The timeline layout of the year view: one row per calendar, days running
// left to right, events as bars. Zoom sets how much of the year fills the
// screen; the track still spans the whole year and scrolls sideways.
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  TASKS_CALENDAR_ID,
  TIMELINE_ZOOMS,
  buildTimelineRows,
  dateFromDayIndex,
  dayIndexInYear,
  daysInYear,
  eventCalendarSpanDays,
  shiftTimelineWindow,
  type CalendarEvent,
  type CalendarSummary,
  type TimelineBar,
  type TimelineZoom,
} from "@julian/domain";
import { openEventInGoogle } from "@/lib/open-event";
import { canMoveEvent } from "@/components/year-view/use-event-move";
import type { KeyboardCell } from "@/components/year-view/year-grid-keyboard";
import {
  TIMELINE_FALLBACK_WIDTH,
  TIMELINE_LANE_HEIGHT,
  TIMELINE_ROW_PADDING,
  adjacentTimelineBar,
  clampDayIndex,
  firstVisibleTimelineBar,
  formatTimelineRange,
  stepZoom,
  timelineDayWidth,
  timelineLabelMode,
  timelineLabelWidth,
  timelineReserveDays,
  windowStartIndex,
  type TimelineMove,
} from "@/components/year-view/timeline-layout";
import {
  TimelineBarItem,
  TimelineHeader,
  TimelineToolbar,
  dayCalc,
} from "@/components/year-view/timeline-parts";

const ARROW_MOVES: Readonly<Record<string, TimelineMove>> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  Home: "home",
  End: "end",
};

export type TimelineViewProps = {
  year: number;
  /** Events already filtered by calendar selection and search. */
  events: ReadonlyArray<CalendarEvent>;
  calendars: ReadonlyArray<CalendarSummary>;
  selectedCalendarIds: ReadonlyArray<string>;
  monthNames: ReadonlyArray<string>;
  /** The URL's focused day; the timeline opens on the window that contains it. */
  focusCell: KeyboardCell | undefined;
  /** Bumped by "Today"; scrolls back to today's window. */
  focusTodaySignal: number;
  canModifyEvent: (event: CalendarEvent) => boolean;
  onRequestCreateEvent: (cell: KeyboardCell) => void;
  onRequestEditEvent: (event: CalendarEvent) => void;
  onRequestMoveEvent: (event: CalendarEvent) => void;
  onRequestDeleteEvent: (event: CalendarEvent) => void;
  onKeyboardHelpOpenChange: (open: boolean) => void;
  onRegisterFocus: (focus: (() => void) | null) => void;
  /** Records the window being looked at in the URL; may change the year. */
  onFocusDateChange: (target: { year: number; cell: KeyboardCell }) => void;
};

export default function TimelineView({
  year,
  events,
  calendars,
  selectedCalendarIds,
  monthNames,
  focusCell,
  focusTodaySignal,
  canModifyEvent,
  onRequestCreateEvent,
  onRequestEditEvent,
  onRequestMoveEvent,
  onRequestDeleteEvent,
  onKeyboardHelpOpenChange,
  onRegisterFocus,
  onFocusDateChange,
}: TimelineViewProps) {
  const [zoom, setZoom] = useState<TimelineZoom>("quarter");
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const [visibleStart, setVisibleStart] = useState(0);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [today] = useState(() => new Date());
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const viewportWidth = measuredWidth || TIMELINE_FALLBACK_WIDTH;
  const totalDays = daysInYear(year);
  const labelWidth = timelineLabelWidth(viewportWidth);
  const dayWidth = timelineDayWidth(viewportWidth, zoom, year);
  const trackViewport = Math.max(1, viewportWidth - labelWidth);
  const visibleDays = Math.max(1, Math.floor(trackViewport / dayWidth));
  const todayIndex = today.getFullYear() === year ? dayIndexInYear(today, year) : null;

  const calendarById = useMemo(
    () => new Map(calendars.map((calendar) => [calendar.id, calendar])),
    [calendars],
  );
  const rows = useMemo(() => {
    const selected = new Set(selectedCalendarIds);
    const ids = calendars.map((calendar) => calendar.id).filter((id) => selected.has(id));
    return buildTimelineRows(events, ids, year, (event) =>
      timelineReserveDays(event.title, eventCalendarSpanDays(event), dayWidth),
    );
  }, [calendars, dayWidth, events, selectedCalendarIds, year]);
  const barsByKey = useMemo(
    () => new Map(rows.flatMap((row) => row.bars.map((bar) => [bar.key, bar] as const))),
    [rows],
  );
  const tabStopKey =
    activeKey !== null && barsByKey.has(activeKey)
      ? activeKey
      : firstVisibleTimelineBar(rows, visibleStart);

  // Scrolling is imperative: a target day index waits in `pendingRef` until
  // the layout it depends on has committed, then lands at the track's left
  // edge. `startRef` mirrors the left-edge day for the effects below.
  const layoutRef = useRef({ dayWidth, trackViewport, zoom });
  const pendingRef = useRef<number | null>(null);
  const startRef = useRef(0);
  // Until the reader scrolls by hand, `startRef` is the truth and the scroll
  // position follows it, even when late layout (data arriving, a scrollbar
  // appearing) clamps or shifts a programmatic scroll.
  const userScrolledRef = useRef(false);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const applyPending = useCallback(() => {
    const container = scrollRef.current;
    const target = pendingRef.current;
    if (!container || target === null) return;
    pendingRef.current = null;
    startRef.current = target;
    userScrolledRef.current = false;
    container.scrollTo({ left: target * layoutRef.current.dayWidth });
  }, []);
  const markUserScroll = useCallback(() => {
    userScrolledRef.current = true;
  }, []);

  const anchorMonth = focusCell?.month;
  const anchorDay = focusCell?.day;

  // A new zoom keeps the focused day on screen if it was, else the day in the
  // middle; a resize keeps the window around the middle day.
  useLayoutEffect(() => {
    const previous = layoutRef.current;
    const changed = previous.dayWidth !== dayWidth || previous.zoom !== zoom;
    if (pendingRef.current === null && changed) {
      const start = startRef.current;
      const shown = Math.max(1, Math.floor(previous.trackViewport / previous.dayWidth));
      const focus =
        anchorMonth !== undefined
          ? dayIndexInYear(new Date(year, anchorMonth, anchorDay ?? 1), year)
          : null;
      const pivot =
        previous.zoom !== zoom && focus !== null && focus >= start && focus < start + shown
          ? focus
          : start + Math.floor(shown / 2);
      pendingRef.current = windowStartIndex(
        zoom,
        dateFromDayIndex(year, clampDayIndex(pivot, year)),
        year,
      );
    }
    layoutRef.current = { dayWidth, trackViewport, zoom };
    applyPending();
  }, [anchorDay, anchorMonth, applyPending, dayWidth, trackViewport, year, zoom]);

  useLayoutEffect(() => {
    const now = new Date();
    const date =
      anchorMonth !== undefined
        ? new Date(year, anchorMonth, anchorDay ?? 1)
        : now.getFullYear() === year
          ? now
          : new Date(year, 0, 1);
    pendingRef.current = windowStartIndex(layoutRef.current.zoom, date, year);
    applyPending();
  }, [anchorDay, anchorMonth, applyPending, year]);

  useEffect(() => {
    if (focusTodaySignal === 0) return;
    const now = new Date();
    if (now.getFullYear() !== year) return;
    pendingRef.current = windowStartIndex(layoutRef.current.zoom, now, year);
    applyPending();
  }, [applyPending, focusTodaySignal, year]);

  useEffect(() => {
    const container = scrollRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const observer = new ResizeObserver(() => {
      setMeasuredWidth(container.clientWidth);
      if (!userScrolledRef.current) {
        container.scrollTo({ left: startRef.current * layoutRef.current.dayWidth });
      }
    });
    observer.observe(container);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  const frameRef = useRef<number | null>(null);
  const onScroll = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      const container = scrollRef.current;
      if (!container) return;
      const start = Math.round(container.scrollLeft / layoutRef.current.dayWidth);
      if (userScrolledRef.current) startRef.current = start;
      setVisibleStart(start);
    });
  }, []);
  useEffect(
    () => () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    },
    [],
  );

  const step = useCallback(
    (direction: -1 | 1) => {
      const center = clampDayIndex(visibleStart + Math.floor(visibleDays / 2), year);
      const target = shiftTimelineWindow(zoom, dateFromDayIndex(year, center), direction);
      const cell = { month: target.getMonth(), day: target.getDate() };
      if (target.getFullYear() === year) {
        pendingRef.current = windowStartIndex(zoom, target, year);
        applyPending();
      }
      onFocusDateChange({ year: target.getFullYear(), cell });
    },
    [applyPending, onFocusDateChange, visibleDays, visibleStart, year, zoom],
  );

  const goToToday = useCallback(() => {
    const now = new Date();
    if (now.getFullYear() === year) {
      pendingRef.current = windowStartIndex(zoom, now, year);
      applyPending();
    }
    onFocusDateChange({
      year: now.getFullYear(),
      cell: { month: now.getMonth(), day: now.getDate() },
    });
  }, [applyPending, onFocusDateChange, year, zoom]);

  const focusBar = useCallback(
    (key: string) => {
      const container = scrollRef.current;
      const element = container?.querySelector<HTMLElement>(
        `[data-timeline-key="${CSS.escape(key)}"]`,
      );
      const bar = barsByKey.get(key);
      setActiveKey(key);
      if (!container || !element || !bar) return;
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: "nearest", inline: "nearest" });
      // The sticky calendar column covers the first `labelWidth` pixels.
      const start = bar.startIndex * dayWidth;
      const end = (bar.endIndex + 1) * dayWidth;
      if (start < container.scrollLeft || end > container.scrollLeft + trackViewport) {
        container.scrollTo({ left: Math.max(0, start - dayWidth) });
      }
    },
    [barsByKey, dayWidth, trackViewport],
  );

  const focusTimeline = useCallback(() => {
    if (tabStopKey) focusBar(tabStopKey);
    else scrollRef.current?.focus();
  }, [focusBar, tabStopKey]);

  useEffect(() => {
    onRegisterFocus(focusTimeline);
    return () => onRegisterFocus(null);
  }, [focusTimeline, onRegisterFocus]);

  const activateBar = useCallback(
    (bar: TimelineBar) => {
      setActiveKey(bar.key);
      const { event } = bar;
      if (event.htmlLink || event.calendarId === TASKS_CALENDAR_ID) openEventInGoogle(event);
      else if (canModifyEvent(event)) onRequestEditEvent(event);
    },
    [canModifyEvent, onRequestEditEvent],
  );

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.defaultPrevented) return;
    const key =
      event.target instanceof HTMLElement
        ? (event.target.closest("[data-timeline-key]")?.getAttribute("data-timeline-key") ?? null)
        : null;
    const bar = key ? barsByKey.get(key) : undefined;
    const claim = () => event.preventDefault();

    if ((event.metaKey || event.ctrlKey) && (event.key === "Backspace" || event.key === "Delete")) {
      if (bar && canModifyEvent(bar.event)) {
        claim();
        onRequestDeleteEvent(bar.event);
      }
      return;
    }
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const move = ARROW_MOVES[event.key];
    if (move && bar) {
      const next = adjacentTimelineBar(rows, bar.key, move);
      claim();
      if (next) focusBar(next);
      return;
    }

    switch (event.key) {
      case "+":
      case "=":
        claim();
        setZoom((current) => stepZoom(TIMELINE_ZOOMS, current, -1));
        return;
      case "-":
      case "_":
        claim();
        setZoom((current) => stepZoom(TIMELINE_ZOOMS, current, 1));
        return;
      case "[":
      case "]":
        claim();
        step(event.key === "[" ? -1 : 1);
        return;
      case "?":
        claim();
        onKeyboardHelpOpenChange(true);
        return;
      default:
        break;
    }

    switch (event.key.toLowerCase()) {
      case "n": {
        claim();
        const date = dateFromDayIndex(year, bar?.startIndex ?? visibleStart);
        onRequestCreateEvent({ month: date.getMonth(), day: date.getDate() });
        return;
      }
      case "e":
        if (bar && canModifyEvent(bar.event)) {
          claim();
          onRequestEditEvent(bar.event);
        }
        return;
      case "m":
        if (bar && canMoveEvent(bar.event, canModifyEvent)) {
          claim();
          onRequestMoveEvent(bar.event);
        }
        return;
      default:
        return;
    }
  };

  // Sitting on a window boundary (after Today, a step or a deep link), name
  // that window: "November 2026" even though 31 day-widths are on screen.
  const firstVisible = clampDayIndex(visibleStart, year);
  const firstDate = dateFromDayIndex(year, firstVisible);
  // On a phone the window can be wider than the screen; name what is shown.
  const lastVisible =
    windowStartIndex(zoom, firstDate, year) === firstVisible
      ? Math.min(
          dayIndexInYear(shiftTimelineWindow(zoom, firstDate, 1), year) - 1,
          firstVisible + visibleDays,
        )
      : firstVisible + visibleDays - 1;
  const rangeLabel = formatTimelineRange(year, firstVisible, lastVisible);
  const saturdayIndex = (6 - new Date(year, 0, 1).getDay() + 7) % 7;
  const showDayLines = dayWidth >= 8;

  const canvasStyle = {
    "--day-w": `${dayWidth}px`,
    "--label-w": `${labelWidth}px`,
    "--timeline-days": totalDays,
  } as CSSProperties;

  return (
    <section className="flex h-full min-h-0 flex-col" aria-label={`Timeline for ${year}`}>
      <TimelineToolbar
        rangeLabel={rangeLabel}
        zoom={zoom}
        zooms={TIMELINE_ZOOMS}
        onZoomChange={setZoom}
        onStep={step}
        onToday={goToToday}
      />
      <div
        ref={scrollRef}
        data-timeline-root=""
        role="group"
        className="timeline-scroll scroll-guard-x relative min-h-0 flex-1 overflow-auto scrollbar-minimal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50"
        tabIndex={tabStopKey ? -1 : 0}
        aria-label={`Timeline, ${rangeLabel}`}
        aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Home End BracketLeft BracketRight Plus Minus N E M QuestionMark"
        onScroll={onScroll}
        onKeyDown={(event) => {
          markUserScroll();
          onKeyDown(event);
        }}
        onWheel={markUserScroll}
        onPointerDown={markUserScroll}
        onTouchStart={markUserScroll}
      >
        <div
          ref={canvasRef}
          className="timeline-canvas relative w-max min-w-full"
          style={canvasStyle}
        >
          <TimelineHeader
            year={year}
            totalDays={totalDays}
            dayWidth={dayWidth}
            todayIndex={todayIndex}
            monthNames={monthNames}
          />
          <div className="relative">
            <div
              aria-hidden="true"
              className="timeline-grid pointer-events-none absolute inset-y-0"
              style={{
                left: "var(--label-w)",
                width: dayCalc(totalDays),
                backgroundImage: [
                  showDayLines
                    ? "linear-gradient(to right, color-mix(in oklab, var(--border) 60%, transparent) 1px, transparent 1px)"
                    : null,
                  showDayLines
                    ? "linear-gradient(to right, color-mix(in oklab, var(--muted) 70%, transparent) calc(var(--day-w) * 2), transparent 0)"
                    : null,
                ]
                  .filter(Boolean)
                  .join(", "),
                backgroundSize: showDayLines ? `var(--day-w) 100%, ${dayCalc(7)} 100%` : undefined,
                backgroundPosition: showDayLines ? `0 0, ${dayCalc(saturdayIndex)} 0` : undefined,
              }}
            >
              {monthNames.map((name, month) => (
                <span
                  key={name}
                  className="absolute inset-y-0 w-px bg-foreground/25"
                  style={{ left: dayCalc(dayIndexInYear(new Date(year, month, 1), year)) }}
                />
              ))}
              {todayIndex !== null && (
                <span
                  className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-[var(--accent-brand)]"
                  style={{ left: dayCalc(todayIndex + 0.5) }}
                  data-testid="timeline-today"
                />
              )}
            </div>

            {rows.length === 0 ? (
              <p className="sticky left-0 px-6 py-10 text-sm text-muted-foreground">
                No calendars selected. Choose calendars in the sidebar to see them here.
              </p>
            ) : (
              rows.map((row) => {
                const calendar = calendarById.get(row.calendarId);
                const labelId = `timeline-row-${row.calendarId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
                const color = calendar?.backgroundColor ?? "#6b7280";
                return (
                  <div
                    key={row.calendarId}
                    role="group"
                    aria-labelledby={labelId}
                    className="flex border-b border-border/50"
                  >
                    <div className="timeline-label-col sticky left-0 z-10 flex shrink-0 items-start gap-2 border-r border-border/60 bg-background px-3 py-2">
                      <span
                        aria-hidden="true"
                        className="mt-1 size-2.5 shrink-0 rounded-full"
                        style={{ background: color }}
                      />
                      <span className="min-w-0">
                        <span id={labelId} className="block truncate text-xs font-medium">
                          {calendar?.summary ?? row.calendarId}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {row.bars.length === 1 ? "1 event" : `${row.bars.length} events`}
                        </span>
                      </span>
                    </div>
                    <div
                      className="timeline-track relative shrink-0"
                      style={{ height: row.lanes * TIMELINE_LANE_HEIGHT + TIMELINE_ROW_PADDING }}
                    >
                      {row.bars.map((bar) => (
                        <TimelineBarItem
                          key={bar.key}
                          bar={bar}
                          calendar={calendar}
                          labelMode={timelineLabelMode(
                            (bar.endIndex - bar.startIndex + 1) * dayWidth,
                            bar.event.title,
                          )}
                          tabbable={bar.key === tabStopKey}
                          onActivate={activateBar}
                          onFocus={setActiveKey}
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
