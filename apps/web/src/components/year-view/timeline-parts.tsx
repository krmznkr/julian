import { memo, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  TASKS_CALENDAR_ID,
  dateFromDayIndex,
  eventCalendarSpanDays,
  formatDateRange,
  toDateInputValue,
  type CalendarSummary,
  type TimelineBar,
  type TimelineZoom,
} from "@julian/domain";
import { EventChipTooltip } from "@/components/event-chip-parts";
import { Tooltip, TooltipTrigger } from "@/components/tooltip";
import { Button } from "@/components/ui/button";
import { useEventLabels } from "@/components/use-event-chip";
import {
  TIMELINE_LANE_HEIGHT,
  TIMELINE_ROW_PADDING,
  TIMELINE_ZOOM_LABELS,
  timelineLabelPx,
  type TimelineLabelMode,
} from "@/components/year-view/timeline-layout";
import { cn } from "@/lib/utils";

const BAR_HEIGHT = TIMELINE_LANE_HEIGHT - 6;
// Built once: constructing an Intl formatter per day label is slow.
const WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const DAY_FORMAT_SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function TimelineToolbar({
  rangeLabel,
  zoom,
  zooms,
  onZoomChange,
  onStep,
  onToday,
}: {
  rangeLabel: string;
  zoom: TimelineZoom;
  zooms: ReadonlyArray<TimelineZoom>;
  onZoomChange: (zoom: TimelineZoom) => void;
  onStep: (direction: -1 | 1) => void;
  onToday: () => void;
}) {
  const unit = TIMELINE_ZOOM_LABELS[zoom].toLowerCase();
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2 md:px-6 print:hidden">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Previous ${unit}`}
          aria-keyshortcuts="BracketLeft"
          onClick={() => onStep(-1)}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Next ${unit}`}
          aria-keyshortcuts="BracketRight"
          onClick={() => onStep(1)}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="outline" size="sm" className="ml-1 px-3 md:hidden" onClick={onToday}>
          Today
        </Button>
      </div>
      <h2
        className="min-w-0 flex-1 truncate text-sm font-semibold tabular-nums md:text-base"
        aria-live="polite"
        data-testid="timeline-range"
      >
        {rangeLabel}
      </h2>
      <div
        role="group"
        aria-label="Zoom"
        className="flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5"
      >
        {zooms.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={option === zoom}
            onClick={() => onZoomChange(option)}
            className={cn(
              "h-8 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:px-3",
              option === zoom && "bg-background text-foreground shadow-sm",
            )}
          >
            {TIMELINE_ZOOM_LABELS[option]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Month names, then day numbers or week ticks when there is room for them. */
export const TimelineHeader = memo(function TimelineHeader({
  year,
  totalDays,
  dayWidth,
  todayIndex,
  monthNames,
  compact,
}: {
  year: number;
  totalDays: number;
  dayWidth: number;
  todayIndex: number | null;
  monthNames: ReadonlyArray<string>;
  compact: boolean;
}) {
  const days = Array.from({ length: totalDays }, (_, index) => dateFromDayIndex(year, index));
  const months = monthNames.map((name, month) => {
    const start = days.findIndex((date) => date.getMonth() === month);
    const length = new Date(year, month + 1, 0).getDate();
    return { name, month, start, length };
  });
  const showDays = dayWidth >= 18;
  const showWeeks = !showDays && dayWidth * 7 >= 22;

  return (
    <div
      className="timeline-header sticky top-0 z-20 flex border-b border-border/60 bg-background"
      aria-hidden="true"
    >
      {compact ? null : (
        <div className="timeline-label-col sticky left-0 z-10 flex shrink-0 items-end border-r border-border/60 bg-background px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Calendars
        </div>
      )}
      <div className={cn("timeline-track relative shrink-0", showDays ? "h-14" : "h-12")}>
        {months.map(({ name, start, length }) => (
          <div
            key={name}
            className="absolute top-0 h-full border-l border-foreground/25"
            style={{ left: dayCalc(start), width: dayCalc(length) }}
          >
            <span className="timeline-sticky-label sticky inline-block truncate px-1.5 pt-1 text-xs font-semibold text-foreground">
              {dayWidth * length >= 96 ? name : name.slice(0, 3)}
              {dayWidth * length >= 120 ? ` ${year}` : ""}
            </span>
          </div>
        ))}
        {showDays &&
          days.map((date, index) => (
            <span
              key={toDateInputValue(date)}
              className={cn(
                "timeline-day-label absolute bottom-0 flex h-8 flex-col items-center justify-center text-[11px] leading-none tabular-nums text-muted-foreground",
                (date.getDay() === 0 || date.getDay() === 6) && "text-muted-foreground/70",
                // The dated today chip sits on top of this label.
                index === todayIndex && "invisible",
              )}
              style={{ left: dayCalc(index), width: dayCalc(1) }}
            >
              <span className="text-[9px] font-medium uppercase tracking-wide">
                {dayWidth >= 40
                  ? WEEKDAY_FORMAT.format(date)
                  : WEEKDAY_FORMAT.format(date).slice(0, 2)}
              </span>
              <span className="mt-0.5">{date.getDate()}</span>
            </span>
          ))}
        {showWeeks &&
          days.map((date, index) =>
            date.getDay() === 1 ? (
              <span
                key={toDateInputValue(date)}
                className="timeline-day-label absolute bottom-0 h-6 border-l border-border/40 pl-1 pt-1 text-[11px] tabular-nums text-muted-foreground"
                style={{ left: dayCalc(index) }}
              >
                {date.getDate()}
              </span>
            ) : null,
          )}
        {todayIndex !== null && (
          <span
            className="timeline-today-chip absolute bottom-0.5 z-10 -translate-x-1/2 rounded-full bg-[var(--accent-brand-text)] px-1.5 py-px text-[11px] font-semibold tabular-nums leading-4 text-background"
            style={{ left: dayCalc(todayIndex + 0.5) }}
          >
            {DAY_FORMAT_SHORT.format(dateFromDayIndex(year, todayIndex))}
          </span>
        )}
      </div>
    </div>
  );
});

/** Black or white, whichever reads better on a `#rrggbb` fill. */
function readableTextOn(hex: string): string {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return "#ffffff";
  const value = Number.parseInt(match[1] ?? "000000", 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  // Contrast against white vs black: (1.05)/(L+0.05) vs (L+0.05)/0.05.
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? "#ffffff" : "#111111";
}

/** `n` days as a CSS length, so print can rescale the whole timeline through `--day-w`. */
export function dayCalc(days: number, extraPx = 0): string {
  return extraPx === 0
    ? `calc(var(--day-w) * ${days})`
    : `calc(var(--day-w) * ${days} + ${extraPx}px)`;
}

function TimelineBarButton({
  bar,
  calendar,
  labelMode,
  offscreen,
  tabbable,
  onActivate,
  onFocus,
}: {
  bar: TimelineBar;
  calendar: CalendarSummary | undefined;
  labelMode: TimelineLabelMode;
  /** The bar ended left of the screen; a label beside it would be a clipped stub. */
  offscreen: boolean;
  tabbable: boolean;
  onActivate: (bar: TimelineBar) => void;
  onFocus: (key: string) => void;
}) {
  const { event } = bar;
  const { startLabel, endLabel } = useEventLabels(event);
  const span = bar.endIndex - bar.startIndex + 1;
  const top = TIMELINE_ROW_PADDING / 2 + bar.lane * TIMELINE_LANE_HEIGHT;
  const color =
    event.calendarColor ??
    calendar?.backgroundColor ??
    (event.calendarId === TASKS_CALENDAR_ID ? "#8b5cf6" : "#6b7280");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={tabbable ? 0 : -1}
          data-timeline-key={bar.key}
          data-event-chip="true"
          aria-label={`${event.title}, ${formatDateRange(event)}, ${calendar?.summary ?? "Calendar"}`}
          onClick={() => onActivate(bar)}
          onFocus={() => onFocus(bar.key)}
          className={cn(
            "timeline-bar absolute flex items-center overflow-clip rounded px-1.5 text-left text-xs font-medium shadow-[0_0_0_1px_var(--background)] transition-[filter] hover:brightness-110 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            bar.continuesBefore && "rounded-l-none",
            bar.continuesAfter && "rounded-r-none",
          )}
          style={
            {
              "--event-accent-color": color,
              top,
              height: BAR_HEIGHT,
              left: dayCalc(bar.startIndex, 2),
              width: `max(${dayCalc(span, -4)}, 6px)`,
              background: color,
              color: readableTextOn(color),
            } as CSSProperties
          }
        >
          {labelMode === "inside" ? (
            // Sticks to the visible edge while a long bar runs off the left.
            <span className="timeline-bar-title sticky truncate">
              {bar.continuesBefore ? "← " : ""}
              {event.title}
            </span>
          ) : null}
        </button>
      </TooltipTrigger>
      {labelMode === "outside" && !offscreen ? (
        <span
          aria-hidden="true"
          className="timeline-outside-label pointer-events-none absolute flex items-center truncate pl-1.5 text-xs text-foreground/80"
          style={{
            top,
            height: BAR_HEIGHT,
            left: `max(${dayCalc(bar.endIndex + 1)}, ${dayCalc(bar.startIndex, 7)})`,
            maxWidth: timelineLabelPx(event.title),
          }}
        >
          {event.title}
        </span>
      ) : null}
      <EventChipTooltip
        event={event}
        calendar={calendar}
        startLabel={startLabel}
        endLabel={endLabel}
        durationDays={eventCalendarSpanDays(event)}
      />
    </Tooltip>
  );
}

export const TimelineBarItem = memo(TimelineBarButton);
