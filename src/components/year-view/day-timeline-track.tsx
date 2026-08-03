import { memo, useMemo } from "react";
import { DayHourRuler } from "@/components/year-view/day-hour-ruler";
import { formatTimeRange } from "@/components/year-helpers";
import {
  getTimedEventDayPlacement,
  isFullDayTimedPlacement,
  type TimedEventPlacement,
} from "@/components/year-view/day-timeline-placement";
import type { DaySquare } from "@/components/year-view/use-month-column";

function colorOf(square: DaySquare) {
  return square.event.calendarColor ?? "#8b8b8b";
}

function resolvePlacement(
  square: DaySquare,
  year: number,
  month: number,
  day: number,
): TimedEventPlacement | null {
  if (square.allDay) {
    return { leftPct: 0, widthPct: 100 };
  }
  return square.timedPlacement ?? getTimedEventDayPlacement(square.event, year, month, day);
}

function isFullDaySquare(square: DaySquare, placement: TimedEventPlacement | null) {
  return square.allDay || isFullDayTimedPlacement(placement);
}

const DayEventBlock = memo(function DayEventBlock({
  square,
  lane,
  laneCount,
}: {
  square: DaySquare;
  lane: number;
  laneCount: number;
}) {
  const key = square.segment.id;
  const color = colorOf(square);
  const timeLabel = square.timeLabel ?? formatTimeRange(square.event);
  const title = square.event.title;

  return (
    <button
      type="button"
      tabIndex={-1}
      data-event-key={key}
      title={square.allDay ? title : `${title} · ${timeLabel}`}
      aria-label={square.allDay ? title : `${title}, ${timeLabel}`}
      className="year-grid-text-micro absolute z-20 flex items-center overflow-hidden rounded-[2px] border-2 bg-transparent px-1 text-foreground transition hover:bg-background/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      style={{
        left: laneCount > 1 ? `${(lane / laneCount) * 100}%` : "0%",
        width: laneCount > 1 ? `${100 / laneCount}%` : "100%",
        top: "0%",
        height: "100%",
        borderColor: color,
      }}
    >
      <span className="truncate">{title}</span>
    </button>
  );
});

export const DayTimeline = memo(function DayTimeline({
  year,
  month,
  day,
  squares,
}: {
  year: number;
  month: number;
  day: number;
  squares: DaySquare[];
}) {
  // Only full-day / all-day events render inside the cell as hollow outline
  // chips. Partial timed events are intentionally not drawn here — they'd
  // otherwise fill part of the cell background and clutter the day; they remain
  // available in the day detail card.
  const overlayLayer = useMemo(
    () =>
      squares.filter((square) =>
        isFullDaySquare(square, resolvePlacement(square, year, month, day)),
      ),
    [squares, year, month, day],
  );

  return (
    <div
      className="relative h-full min-h-3 w-full overflow-hidden rounded-[3px] bg-muted/55"
      aria-hidden={squares.length === 0}
      title="24-hour day"
    >
      <DayHourRuler className="absolute inset-0 z-[1]" />
      {overlayLayer.map((square, index) => (
        <DayEventBlock
          key={square.segment.id}
          square={square}
          lane={index}
          laneCount={overlayLayer.length}
        />
      ))}
    </div>
  );
});
