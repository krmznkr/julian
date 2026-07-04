import { memo, useMemo } from "react";
import { DayHourRuler } from "@/components/year-view/day-hour-ruler";
import { formatTimeRange } from "@/components/year-helpers";
import {
  getTimedEventDayPlacement,
  isFullDayTimedPlacement,
  type TimedEventPlacement,
} from "@/components/year-view/day-timeline-placement";
import type { DaySquare } from "@/components/year-view/use-month-column";
import { cn } from "@/lib/utils";

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
  year,
  month,
  day,
  isFullDay,
  lane,
  laneCount,
}: {
  square: DaySquare;
  year: number;
  month: number;
  day: number;
  isFullDay: boolean;
  lane: number;
  laneCount: number;
}) {
  const placement = resolvePlacement(square, year, month, day);
  if (!placement) {
    return null;
  }

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
      className={cn(
        "absolute overflow-hidden transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        isFullDay
          ? "year-grid-text-micro z-20 flex items-center rounded-[2px] border-2 bg-transparent px-1 text-foreground hover:bg-background/15"
          : "z-0 rounded-[1px] border-0 hover:brightness-110",
      )}
      style={{
        left: isFullDay && laneCount > 1 ? `${(lane / laneCount) * 100}%` : `${placement.leftPct}%`,
        width: isFullDay && laneCount > 1 ? `${100 / laneCount}%` : `${placement.widthPct}%`,
        top: "0%",
        height: "100%",
        ...(isFullDay
          ? { borderColor: color }
          : { backgroundColor: `color-mix(in srgb, ${color} 42%, var(--background))` }),
      }}
    >
      {isFullDay && <span className="truncate">{title}</span>}
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
  const { backgroundLayer, overlayLayer } = useMemo(() => {
    const { background, overlay } = squares.reduce<{
      background: DaySquare[];
      overlay: DaySquare[];
    }>(
      (acc, square) => {
        const placement = resolvePlacement(square, year, month, day);
        return isFullDaySquare(square, placement)
          ? { ...acc, overlay: [...acc.overlay, square] }
          : { ...acc, background: [...acc.background, square] };
      },
      { background: [], overlay: [] },
    );
    return { backgroundLayer: background, overlayLayer: overlay };
  }, [squares, year, month, day]);

  return (
    <div
      className="relative h-full min-h-3 w-full overflow-hidden rounded-[3px] bg-muted/55"
      aria-hidden={squares.length === 0}
      title="24-hour day"
    >
      <DayHourRuler className="absolute inset-0 z-[1]" />
      {backgroundLayer.map((square) => (
        <DayEventBlock
          key={square.segment.id}
          square={square}
          year={year}
          month={month}
          day={day}
          isFullDay={false}
          lane={0}
          laneCount={1}
        />
      ))}
      {overlayLayer.map((square, index) => (
        <DayEventBlock
          key={square.segment.id}
          square={square}
          year={year}
          month={month}
          day={day}
          isFullDay
          lane={index}
          laneCount={overlayLayer.length}
        />
      ))}
    </div>
  );
});
