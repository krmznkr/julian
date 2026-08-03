import { memo, useMemo } from "react";
import { DayTimeline } from "@/components/year-view/day-timeline-track";
import { isFullDayTimedPlacement } from "@/components/year-view/day-timeline-placement";
import type { DaySquare } from "@/components/year-view/use-month-column";

/**
 * Events rendered inside the year-grid day cell. Only all-day and full-day
 * timed events show here as hollow outline chips — partial timed events are no
 * longer painted onto the cell background; they remain in the day detail card.
 */
export function isCellVisibleSquare(square: DaySquare): boolean {
  if (square.allDay) return true;
  return isFullDayTimedPlacement(square.timedPlacement);
}

export function cellVisibleSquares(squares: DaySquare[]): DaySquare[] {
  return squares.filter(isCellVisibleSquare);
}

export const SingleDayDisplay = memo(function SingleDayDisplay({
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
  const visibleSquares = useMemo(() => cellVisibleSquares(squares), [squares]);

  if (visibleSquares.length === 0) return null;

  return (
    <div className="flex h-full w-full min-w-0 items-stretch overflow-hidden px-0.5 py-0.5">
      <DayTimeline year={year} month={month} day={day} squares={visibleSquares} />
    </div>
  );
});
