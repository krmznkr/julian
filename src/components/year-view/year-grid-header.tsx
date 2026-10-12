import type { CSSProperties, MutableRefObject } from "react";
import {
  YEAR_GRID_LEGEND_HEIGHT,
  YEAR_GRID_MONTH_HEADER_HEIGHT,
} from "@/components/year-view/constants";
import { monthColumnTemplateColumns, visibleYearEventLaneMap } from "./month-grid-layout";
import { cn } from "@/lib/utils";
import type { MonthSegments } from "@/domain";

export default function YearGridHeader({
  isCurrentYear,
  leftCount,
  leftSpacerStyle,
  monthHeaderRefs,
  monthNames,
  rightCount,
  rightSpacerStyle,
  todayMonth,
  visibleMonths,
}: {
  isCurrentYear: boolean;
  leftCount: number;
  leftSpacerStyle: CSSProperties;
  monthHeaderRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  monthNames: string[];
  rightCount: number;
  rightSpacerStyle: CSSProperties;
  todayMonth: number;
  visibleMonths: MonthSegments[];
}) {
  return (
    <div className="sticky top-0 z-20 min-w-max border-b border-border/80 bg-background/95 shadow-sm backdrop-blur">
      <div className="flex min-w-max gap-1" style={{ height: YEAR_GRID_MONTH_HEADER_HEIGHT }}>
        <div
          className="sticky left-0 z-20 w-[var(--day-gutter-width)] shrink-0 border-r border-border/80 bg-background/90 backdrop-blur"
          aria-hidden="true"
        />
        {leftCount > 0 && <div className="shrink-0" style={leftSpacerStyle} />}
        {visibleMonths.map((month) => {
          const isCurrentMonth = isCurrentYear && month.month === todayMonth;

          return (
            <div
              key={`header-${month.month}`}
              ref={(node) => {
                monthHeaderRefs.current[month.month] = node;
              }}
              className={cn(
                "flex w-[var(--month-col-width)] shrink-0 items-center border-r border-border/80 px-2 text-xs text-foreground/70 sm:px-2.5",
                isCurrentMonth && "bg-accent/70 text-foreground",
              )}
            >
              <span className="truncate text-sm font-semibold tracking-tight text-foreground">
                {monthNames[month.month]}
              </span>
            </div>
          );
        })}
        {rightCount > 0 && <div className="shrink-0" style={rightSpacerStyle} />}
      </div>
      <div
        className="flex min-w-max gap-1 border-t border-border/50"
        style={{ height: YEAR_GRID_LEGEND_HEIGHT }}
      >
        <div
          className="sticky left-0 z-20 w-[var(--day-gutter-width)] shrink-0 border-r border-border/80 bg-background/90 backdrop-blur"
          aria-hidden="true"
        />
        {leftCount > 0 && <div className="shrink-0" style={leftSpacerStyle} />}
        {visibleMonths.map((month) => {
          const isCurrentMonth = isCurrentYear && month.month === todayMonth;
          const visibleLanes = visibleYearEventLaneMap(month.segments).laneCount;

          return (
            <div
              key={`ruler-${month.month}`}
              className={cn(
                "grid w-[var(--month-col-width)] shrink-0 border-r border-border/80 bg-muted/25 text-[9px] text-muted-foreground",
                isCurrentMonth && "bg-accent/40",
              )}
              style={{ gridTemplateColumns: monthColumnTemplateColumns(visibleLanes) }}
            >
              <span className="truncate px-1" style={{ gridColumn: "1 / -1" }}>
                Events
              </span>
            </div>
          );
        })}
        {rightCount > 0 && <div className="shrink-0" style={rightSpacerStyle} />}
      </div>
    </div>
  );
}
