import type { CSSProperties, MutableRefObject } from "react";
import type { CalendarEvent, CalendarSummary, MonthSegments } from "@/domain";
import YearGridDayColumn from "@/components/year-view/year-grid-day-column";
import MonthColumn from "@/components/year-view/month-column";
import type { KeyboardCell } from "@/components/year-view/year-grid-keyboard";
import type { YearViewUrlFocus } from "@/components/year-view/use-year-view-url-sync";
import type { useYearGridVirtualization } from "@/components/year-view/use-year-grid-virtualization";

type VirtualizationResult = ReturnType<typeof useYearGridVirtualization>;

export type YearGridProps = {
  months: MonthSegments[];
  events: Map<string, CalendarEvent>;
  calendars: CalendarSummary[];
  year: number;
  scrollRef: MutableRefObject<HTMLDivElement | null>;
  monthHeaderRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  scrollEdges: { left: boolean; right: boolean };
  rowsRef: MutableRefObject<HTMLDivElement | null>;
  rowHeight: number;
  monthNames: string[];
  yearCalendarAriaLabel: string;
  todayLongLabel: string;
  jumpDayHighlight: number | null;
  focusTodaySignal: number;
  keyboardHelpOpen: boolean;
  commandPaletteOpen: boolean;
  mutationDialogOpen: boolean;
  canModifyEvent: (event: CalendarEvent) => boolean;
  onRequestCreateEvent: (cell: KeyboardCell) => void;
  onRequestEditEvent: (event: CalendarEvent) => void;
  onRequestDeleteEvent: (event: CalendarEvent) => void;
  onKeyboardHelpOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
  onRegisterFocusYearGrid: (focus: (() => void) | null) => void;
  urlFocus: YearViewUrlFocus | null;
  shouldApplyUrlFocus: (focus: YearViewUrlFocus | null) => boolean;
  markUrlFocusApplied: (focus: YearViewUrlFocus) => void;
  onUrlFocusChange: (focus: YearViewUrlFocus, options?: { replace?: boolean }) => void;
  onYearNavigate: (year: number, cell: KeyboardCell, detailsOpen: boolean) => void;
};

export function YearGridBody({
  leftCount,
  leftSpacerStyle,
  rightCount,
  rightSpacerStyle,
  visibleMonths,
  isCurrentYear,
  jumpDayHighlight,
  rowHeight,
  todayDay,
  todayLongLabel,
  events,
  year,
  todayMonth,
  activeCell,
  dialogCell,
  dialogActiveKey,
  onDialogActiveKeyChange,
}: {
  leftCount: number;
  leftSpacerStyle: CSSProperties;
  rightCount: number;
  rightSpacerStyle: CSSProperties;
  visibleMonths: VirtualizationResult["visibleMonths"];
  isCurrentYear: boolean;
  jumpDayHighlight: number | null;
  rowHeight: number;
  todayDay: number;
  todayLongLabel: string;
  events: Map<string, CalendarEvent>;
  year: number;
  todayMonth: number;
  activeCell: KeyboardCell;
  dialogCell: KeyboardCell | null;
  dialogActiveKey: string | undefined;
  onDialogActiveKeyChange: (key: string) => void;
}) {
  return (
    <div className="year-grid-height relative flex min-w-max gap-1">
      <YearGridDayColumn
        isCurrentYear={isCurrentYear}
        jumpDayHighlight={jumpDayHighlight}
        todayDay={todayDay}
        todayLongLabel={todayLongLabel}
      />
      {leftCount > 0 && <div style={leftSpacerStyle} />}
      {visibleMonths.map((month) => (
        <MonthColumn
          key={month.month}
          month={month}
          events={events}
          year={year}
          todayDay={todayDay}
          todayMonth={todayMonth}
          isCurrentYear={isCurrentYear}
          rowHeight={rowHeight}
          keyboardFocusedDay={activeCell.month === month.month ? activeCell.day : null}
          keyboardDialogDay={dialogCell?.month === month.month ? dialogCell.day : null}
          dialogActiveKey={dialogCell?.month === month.month ? dialogActiveKey : undefined}
          onDialogActiveKeyChange={onDialogActiveKeyChange}
        />
      ))}
      {rightCount > 0 && <div style={rightSpacerStyle} />}
    </div>
  );
}
