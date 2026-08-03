import { memo } from "react";
import { monthColumnTemplateColumns } from "@/components/year-view/month-grid-layout";
import { cellVisibleSquares, SingleDayDisplay } from "@/components/year-view/single-day-display";
import { cellDomId } from "@/components/year-view/year-grid-keyboard";
import { DAYS_IN_GRID } from "@/components/year-view/constants";
import type { DaySquare } from "@/components/year-view/use-month-column";
import { ROW_HEIGHT } from "@/components/year-helpers";
import { cn } from "@/lib/utils";

const DayCellContent = memo(function DayCellContent({
  day,
  year,
  month,
  squares,
  inStrip,
}: {
  day: number;
  year: number;
  month: number;
  squares: DaySquare[];
  inStrip: boolean;
}) {
  return (
    <div
      data-day-cell={day}
      // On days a multi-day bar passes through, single-day events live in the
      // reserved right-hand strip column so they don't sit under the bars;
      // otherwise they span the full cell width.
      style={{ gridRow: `${day} / ${day + 1}`, gridColumn: inStrip ? "-2 / -1" : "1 / -1" }}
      className="z-10 flex h-full min-w-0 items-stretch"
    >
      <SingleDayDisplay year={year} month={month} day={day} squares={squares} />
    </div>
  );
});

const DayCell = memo(function DayCell({
  day,
  exists,
  isWeekend,
  isToday,
  isKeyboardFocused,
  isDialogDay,
  squares,
  year,
  month,
  inStrip,
}: {
  day: number;
  exists: boolean;
  isWeekend: boolean;
  isToday: boolean;
  isKeyboardFocused: boolean;
  isDialogDay: boolean;
  squares: DaySquare[];
  year: number;
  month: number;
  inStrip: boolean;
}) {
  const visibleSquares = cellVisibleSquares(squares);
  const hasContent = exists && visibleSquares.length > 0;

  return (
    <>
      <div
        id={exists ? cellDomId(year, month, day) : undefined}
        data-day-cell-frame={day}
        role={exists ? "gridcell" : undefined}
        aria-selected={exists && isKeyboardFocused ? true : undefined}
        aria-current={exists && isDialogDay ? "true" : undefined}
        style={{ gridRow: `${day} / ${day + 1}`, gridColumn: "1 / -1" }}
        className={cn(
          "relative min-w-0 border-b border-border/80",
          !exists && "border-b-0",
          exists && isWeekend && "bg-muted/80 dark:bg-muted/60",
          exists && isToday && "bg-[var(--accent-brand)]/5",
          exists &&
            isKeyboardFocused &&
            "z-30 rounded-[3px] ring-2 ring-inset ring-[var(--accent-brand)] bg-[var(--accent-brand)]/12",
        )}
      >
        {exists && (
          <span
            className={cn(
              "year-grid-text-micro pointer-events-none absolute right-0.5 top-0.5 z-20 select-none rounded-[2px] px-0.5 tabular-nums text-muted-foreground/45",
              isWeekend && "text-muted-foreground/55",
              isToday && "font-semibold text-[var(--accent-brand)]",
              isKeyboardFocused && "text-foreground/80",
              hasContent && "bg-background/55 backdrop-blur-[1px]",
            )}
            aria-hidden="true"
          >
            {day}
          </span>
        )}
        {exists && isToday && !isKeyboardFocused && (
          <span
            className="pointer-events-none absolute left-0 top-0 h-full w-0.5 bg-[var(--accent-brand)]/70"
            aria-hidden="true"
          />
        )}
        {exists && isKeyboardFocused && (
          <span
            className="pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-[3px] bg-[var(--accent-brand)]"
            aria-hidden="true"
          />
        )}
      </div>
      {hasContent && (
        <DayCellContent day={day} year={year} month={month} squares={squares} inStrip={inStrip} />
      )}
    </>
  );
});

export const MonthDayCellsLayer = memo(function MonthDayCellsLayer({
  year,
  month,
  daysInMonth,
  weekendRows,
  multiDayLanes,
  hasSingleStrip,
  multiDayCoverageDays,
  singleDayByDay,
  keyboardFocusedDay,
  keyboardDialogDay,
  showTodayLine,
  todayRowTop,
}: {
  year: number;
  month: number;
  daysInMonth: number;
  weekendRows: boolean[];
  multiDayLanes: number;
  hasSingleStrip: boolean;
  multiDayCoverageDays: Set<number>;
  singleDayByDay: Map<number, DaySquare[]>;
  keyboardFocusedDay: number | null;
  keyboardDialogDay: number | null;
  showTodayLine: boolean;
  todayRowTop: number;
}) {
  const todayDay = showTodayLine ? Math.floor(todayRowTop / ROW_HEIGHT) + 1 : null;

  return (
    <div
      className="year-grid-rows absolute inset-0 z-0 grid gap-x-0 gap-y-0 overflow-hidden"
      style={{ gridTemplateColumns: monthColumnTemplateColumns(multiDayLanes, hasSingleStrip) }}
      role="rowgroup"
    >
      {Array.from({ length: DAYS_IN_GRID }, (_, index) => {
        const day = index + 1;
        const exists = day <= daysInMonth;
        return (
          <DayCell
            key={day}
            day={day}
            exists={exists}
            isWeekend={weekendRows[index] ?? false}
            isToday={todayDay === day}
            isKeyboardFocused={keyboardFocusedDay === day}
            isDialogDay={keyboardDialogDay === day}
            squares={singleDayByDay.get(day) ?? []}
            year={year}
            month={month}
            inStrip={hasSingleStrip && multiDayCoverageDays.has(day)}
          />
        );
      })}
    </div>
  );
});
