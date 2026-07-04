import { useYearGridState } from "@/components/year-view/use-year-grid";
import { type YearGridProps, YearGridBody } from "@/components/year-view/year-grid-parts";
import { useYearGridKeyboard } from "@/components/year-view/use-year-grid-keyboard";
import { cellDomId } from "@/components/year-view/year-grid-keyboard";
import YearGridHeader from "@/components/year-view/year-grid-header";
import { YearViewSharedDataProvider } from "@/components/year-view/year-view-context";

function readNumericDataAttribute(element: Element, name: string) {
  const value = element.getAttribute(name);
  if (value === null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export default function YearGrid(props: YearGridProps) {
  const {
    scrollRef,
    rowsRef,
    rowHeight,
    monthHeaderRefs,
    monthNames,
    yearCalendarAriaLabel,
    todayLongLabel,
    jumpDayHighlight,
    focusTodaySignal,
    events,
    months,
    year,
    keyboardHelpOpen,
    commandPaletteOpen,
    mutationDialogOpen,
    canModifyEvent,
    onRequestCreateEvent,
    onRequestEditEvent,
    onRequestDeleteEvent,
    onKeyboardHelpOpenChange,
    onRegisterFocusYearGrid,
    urlFocus,
    shouldApplyUrlFocus,
    markUrlFocusApplied,
    onUrlFocusChange,
    onYearNavigate,
  } = props;

  const { isCurrentYear, todayDay, todayMonth, sharedDataValue, virtualization, todayCell } =
    useYearGridState(props);

  const { leftCount, leftSpacerStyle, rightCount, rightSpacerStyle, visibleMonths } =
    virtualization;

  const keyboard = useYearGridKeyboard({
    year,
    months,
    monthNames,
    events,
    scrollRef,
    monthHeaderRefs,
    rowHeight,
    focusTodaySignal,
    todayCell,
    helpOpen: keyboardHelpOpen,
    commandPaletteOpen,
    mutationDialogOpen,
    canModifyEvent,
    onRequestCreateEvent,
    onRequestEditEvent,
    onRequestDeleteEvent,
    onHelpOpenChange: onKeyboardHelpOpenChange,
    onRegisterFocusGrid: onRegisterFocusYearGrid,
    urlFocus,
    shouldApplyUrlFocus,
    markUrlFocusApplied,
    onUrlFocusChange,
    onYearNavigate,
  });

  return (
    <YearViewSharedDataProvider value={sharedDataValue}>
      <div className="h-full w-full" role="region" aria-label={yearCalendarAriaLabel}>
        <div className="flex h-full min-h-0">
          <div
            ref={scrollRef}
            data-year-grid-root=""
            className="year-grid scroll-guard-x relative flex h-full min-w-0 w-full flex-col overflow-auto font-sans scrollbar-minimal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            tabIndex={0}
            role="application"
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space BracketLeft BracketRight Home End PageUp PageDown Escape QuestionMark N E R 0 1 2 3 4 5 6 7 8 9 Meta+Backspace"
            aria-describedby="year-grid-keyboard-help"
            aria-activedescendant={cellDomId(
              year,
              keyboard.activeCell.month,
              keyboard.activeCell.day,
            )}
            onPointerDown={(event) => {
              event.currentTarget.focus({ preventScroll: true });
            }}
            onClick={(event) => {
              if (event.defaultPrevented) return;
              const target = event.target instanceof Element ? event.target : null;
              const monthColumn = target?.closest("[data-month-column]");
              if (!monthColumn) return;

              const month = readNumericDataAttribute(monthColumn, "data-month-column");
              if (month === null) return;

              const dayElement = target?.closest("[data-day-cell], [data-day-cell-frame]");
              const explicitDay = dayElement
                ? readNumericDataAttribute(
                    dayElement,
                    dayElement.hasAttribute("data-day-cell")
                      ? "data-day-cell"
                      : "data-day-cell-frame",
                  )
                : null;

              const monthRect = monthColumn.getBoundingClientRect();
              const pointerDay = Math.floor((event.clientY - monthRect.top) / rowHeight) + 1;
              const day = explicitDay ?? pointerDay;
              const daysInMonth = new Date(year, month + 1, 0).getDate();
              if (day < 1 || day > daysInMonth) return;

              event.preventDefault();
              keyboard.openDayDetails({ month, day });
            }}
          >
            <p id="year-grid-keyboard-help" className="sr-only">
              Arrow keys move between days, or between events when day details are open. Shift with
              arrows jumps weeks or months. Alt with arrows jumps months or years. Home and End jump
              to month boundaries. Page up and page down move one week. Question mark opens the
              shortcuts dialog. Command K opens commands. S toggles the sidebar. T jumps to today. R
              refreshes events. Type a day number to jump within the active month.
            </p>
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {keyboard.announcement}
            </div>
            {keyboard.dateChangePreview !== null && (
              <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
                <div className="grid min-w-64 place-items-center gap-1 rounded-lg border border-border bg-popover px-8 py-5 text-center text-popover-foreground shadow-lg">
                  <span className="max-w-56 truncate text-sm font-medium text-muted-foreground">
                    {monthNames[keyboard.dateChangePreview.month]}
                  </span>
                  <span className="text-6xl font-semibold tabular-nums leading-none tracking-normal">
                    {keyboard.dateChangePreview.day}
                  </span>
                </div>
              </div>
            )}
            <div className="flex min-h-full min-w-max flex-1 flex-col px-[var(--grid-pad-x)] pb-4">
              <YearGridHeader
                isCurrentYear={isCurrentYear}
                leftCount={leftCount}
                leftSpacerStyle={leftSpacerStyle}
                monthHeaderRefs={monthHeaderRefs}
                monthNames={monthNames}
                rightCount={rightCount}
                rightSpacerStyle={rightSpacerStyle}
                todayMonth={todayMonth}
                visibleMonths={visibleMonths}
              />
              <div
                ref={rowsRef}
                className="year-grid-top-pad flex min-h-0 min-w-max flex-1 overflow-visible"
              >
                <YearGridBody
                  leftCount={leftCount}
                  leftSpacerStyle={leftSpacerStyle}
                  rightCount={rightCount}
                  rightSpacerStyle={rightSpacerStyle}
                  visibleMonths={visibleMonths}
                  isCurrentYear={isCurrentYear}
                  jumpDayHighlight={jumpDayHighlight}
                  rowHeight={rowHeight}
                  todayDay={todayDay}
                  todayLongLabel={todayLongLabel}
                  events={events}
                  year={year}
                  todayMonth={todayMonth}
                  activeCell={keyboard.activeCell}
                  dialogCell={keyboard.dialogCell}
                  dialogActiveKey={keyboard.dialogActiveKey}
                  onDialogActiveKeyChange={keyboard.setDialogActiveKey}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </YearViewSharedDataProvider>
  );
}
