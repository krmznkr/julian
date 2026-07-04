import { memo } from "react";
import { DAY_TIMELINE_MARK_HOURS, hourToDayPct } from "@/components/year-view/constants";
import { cn } from "@/lib/utils";

/** Sticky header: month name row + hour ruler row. */
export const YEAR_GRID_MONTH_HEADER_HEIGHT = 32;
export const YEAR_GRID_HOUR_RULER_HEIGHT = 16;
export const YEAR_GRID_HEADER_HEIGHT =
  YEAR_GRID_MONTH_HEADER_HEIGHT + YEAR_GRID_HOUR_RULER_HEIGHT + 1;

export const DayHourRuler = memo(function DayHourRuler({
  showLabels = false,
  className,
}: {
  showLabels?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("relative h-full w-full min-w-0 px-0.5", className)}
      aria-hidden={!showLabels}
    >
      {DAY_TIMELINE_MARK_HOURS.map((hour) => (
        <div
          key={hour}
          className="pointer-events-none absolute top-0 flex h-full -translate-x-1/2 flex-col items-center"
          style={{ left: `${hourToDayPct(hour)}%` }}
        >
          {showLabels && (
            <span className="year-grid-text-micro tabular-nums text-muted-foreground/80">
              {hour}
            </span>
          )}
          <span
            className={cn(
              "w-px bg-border/45 dark:bg-border/35",
              showLabels ? "mt-0.5 flex-1" : "h-full",
            )}
          />
        </div>
      ))}
    </div>
  );
});
