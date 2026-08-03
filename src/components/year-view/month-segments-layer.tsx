import { memo, useMemo, useRef } from "react";
import { DayHoverPopover } from "@/components/year-view/day-hover-popover";
import { MonthDayCellsLayer } from "@/components/year-view/month-day-cells-layer";
import { hasSingleDayStrip } from "@/components/year-view/month-grid-layout";
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

  const hasSingleStrip = hasSingleDayStrip(multiDayLanes, singleDayByDay.size > 0);
  // Days covered by a multi-day bar — single-day events on these days move into
  // the reserved strip column so the two layers divide the width.
  const multiDayCoverageDays = useMemo(
    () =>
      new Set(
        bars.flatMap((bar) =>
          Array.from(
            { length: bar.segment.endDay - bar.segment.startDay + 1 },
            (_, offset) => bar.segment.startDay + offset,
          ),
        ),
      ),
    [bars],
  );

  return (
    <div ref={layerRef} className="absolute inset-0">
      <MonthDayCellsLayer
        year={year}
        month={month}
        daysInMonth={daysInMonth}
        weekendRows={weekendRows}
        multiDayLanes={multiDayLanes}
        hasSingleStrip={hasSingleStrip}
        multiDayCoverageDays={multiDayCoverageDays}
        singleDayByDay={singleDayByDay}
        keyboardFocusedDay={keyboardFocusedDay}
        keyboardDialogDay={keyboardDialogDay}
        showTodayLine={_showTodayLine}
        todayRowTop={_todayRowTop}
      />
      <SegmentGrid
        month={month}
        multiDayLanes={multiDayLanes}
        hasSingleStrip={hasSingleStrip}
        bars={bars}
      />
      <DayHoverPopover
        open={panel.open}
        label={panel.label}
        items={panel.items}
        activeKey={dialogActiveKey}
        anchorEl={panel.anchorEl}
        anchorRect={panel.anchorRect}
        onSelect={onDialogActiveKeyChange}
        setPopoverEl={panel.setPopoverEl}
      />
    </div>
  );
}

export default memo(MonthSegmentsLayer);
