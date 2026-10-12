import { memo, useRef } from "react";
import { DayHoverPopover } from "@/components/year-view/day-hover-popover";
import { MonthDayCellsLayer } from "@/components/year-view/month-day-cells-layer";
import { SegmentGrid } from "@/components/year-view/month-segments-layer-parts";
import { useMonthDayPanel } from "@/components/year-view/use-month-day-panel";
import { ROW_HEIGHT } from "@/components/year-helpers";
import type { DayEventItem, DaySquare, RenderedBar } from "@/components/year-view/use-month-column";

function MonthSegmentsLayer({
  year,
  month,
  monthName,
  daysInMonth,
  weekendRows,
  multiDayLanes,
  bars,
  singleDayByDay,
  dayEvents,
  showTodayLine: _showTodayLine,
  todayRowTop: _todayRowTop,
  keyboardFocusedDay,
  keyboardDialogDay,
  dialogActiveKey,
  onDialogActiveKeyChange,
}: {
  year: number;
  month: number;
  monthName: string;
  daysInMonth: number;
  weekendRows: boolean[];
  multiDayLanes: number;
  bars: RenderedBar[];
  singleDayByDay: Map<number, DaySquare[]>;
  dayEvents: Map<number, DayEventItem[]>;
  showTodayLine: boolean;
  todayRowTop: number;
  keyboardFocusedDay: number | null;
  keyboardDialogDay: number | null;
  dialogActiveKey: string | undefined;
  onDialogActiveKeyChange: (key: string) => void;
}) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const panel = useMonthDayPanel(dayEvents, monthName, keyboardDialogDay, layerRef, ROW_HEIGHT);

  return (
    <div ref={layerRef} className="absolute inset-0">
      <MonthDayCellsLayer
        year={year}
        month={month}
        daysInMonth={daysInMonth}
        weekendRows={weekendRows}
        multiDayLanes={multiDayLanes}
        hasSingleStrip={false}
        singleDayByDay={singleDayByDay}
        keyboardFocusedDay={keyboardFocusedDay}
        keyboardDialogDay={keyboardDialogDay}
        showTodayLine={_showTodayLine}
        todayRowTop={_todayRowTop}
      />
      <SegmentGrid multiDayLanes={multiDayLanes} bars={bars} />
      <DayHoverPopover
        open={panel.open}
        label={panel.label}
        items={panel.items}
        activeKey={dialogActiveKey}
        anchorEl={panel.anchorEl}
        anchorRect={panel.anchorRect}
        onSelect={onDialogActiveKeyChange}
      />
    </div>
  );
}

export default memo(MonthSegmentsLayer);
