import { memo } from "react";
import MonthSegmentsLayer from "@/components/year-view/month-segments-layer";
import { useYearViewSharedData } from "@/components/year-view/year-view-context";
import { useRenderedSegments, useWeekendRows } from "@/components/year-view/use-month-column";
import type { CalendarEvent, MonthSegments } from "@/domain";

function MonthColumn({
  month,
  events,
  year,
  todayDay,
  todayMonth,
  isCurrentYear,
  rowHeight,
  keyboardFocusedDay,
  keyboardDialogDay,
  dialogActiveKey,
  onDialogActiveKeyChange,
}: {
  month: MonthSegments;
  events: Map<string, CalendarEvent>;
  year: number;
  todayDay: number;
  todayMonth: number;
  isCurrentYear: boolean;
  rowHeight: number;
  keyboardFocusedDay: number | null;
  keyboardDialogDay: number | null;
  dialogActiveKey: string | undefined;
  onDialogActiveKeyChange: (key: string) => void;
}) {
  const { calendars, monthNames } = useYearViewSharedData();
  const showTodayLine = isCurrentYear && month.month === todayMonth;
  const daysInMonth = new Date(year, month.month + 1, 0).getDate();
  const todayRowTop = (todayDay - 1) * rowHeight;

  const { bars, singleDayByDay, dayEvents, multiDayLanes } = useRenderedSegments(
    month,
    events,
    calendars,
    year,
  );
  const weekendRows = useWeekendRows(year, month.month, daysInMonth);

  return (
    <div
      data-month-column={month.month}
      className="year-grid-height flex w-[var(--month-col-width)] shrink-0 flex-col border-r border-border/80 bg-background [content-visibility:auto]"
    >
      <div className="relative h-full">
        <MonthSegmentsLayer
          year={year}
          month={month.month}
          monthName={monthNames[month.month] ?? ""}
          daysInMonth={daysInMonth}
          weekendRows={weekendRows}
          multiDayLanes={multiDayLanes}
          bars={bars}
          singleDayByDay={singleDayByDay}
          dayEvents={dayEvents}
          showTodayLine={showTodayLine}
          todayRowTop={todayRowTop}
          keyboardFocusedDay={keyboardFocusedDay}
          keyboardDialogDay={keyboardDialogDay}
          dialogActiveKey={dialogActiveKey}
          onDialogActiveKeyChange={onDialogActiveKeyChange}
        />
      </div>
    </div>
  );
}

export default memo(MonthColumn);
