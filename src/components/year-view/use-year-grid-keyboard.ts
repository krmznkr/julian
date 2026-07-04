import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { YEAR_GRID_HEADER_HEIGHT } from "@/components/year-view/day-hour-ruler";
import type { YearViewUrlFocus } from "@/components/year-view/use-year-view-url-sync";
import { getOrderedDayEvents } from "@/components/year-view/use-month-column";
import {
  clampCell,
  firstDayOfMonth,
  lastDayOfMonth,
  moveCellByDays,
  applyArrowMoveStep,
  daysInMonth,
  digitFromKeyboardCode,
  resolveDayTypeaheadInput,
  resolveArrowMoveStep,
  shouldHandleGridKeys,
  type KeyboardCell,
} from "@/components/year-view/year-grid-keyboard";
import { MAX_YEAR, MIN_YEAR } from "@/components/year-view/constants";
import { focusSignature } from "@/lib/year-view-url";
import { openDayInGoogleCalendar, openEventInGoogle } from "@/lib/open-event";
import type { CalendarEvent, MonthSegments } from "@/domain";

const DAY_TYPEAHEAD_COMMIT_DELAY_MS = 650;
const DAY_TYPEAHEAD_FEEDBACK_MS = 450;
const DATE_CHANGE_FEEDBACK_MS = 700;

type UseYearGridKeyboardArgs = {
  year: number;
  months: MonthSegments[];
  monthNames: string[];
  events: Map<string, CalendarEvent>;
  scrollRef: MutableRefObject<HTMLDivElement | null>;
  monthHeaderRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  rowHeight: number;
  focusTodaySignal: number;
  todayCell: KeyboardCell;
  helpOpen: boolean;
  commandPaletteOpen: boolean;
  mutationDialogOpen: boolean;
  canModifyEvent: (event: CalendarEvent) => boolean;
  onRequestCreateEvent: (cell: KeyboardCell) => void;
  onRequestEditEvent: (event: CalendarEvent) => void;
  onRequestDeleteEvent: (event: CalendarEvent) => void;
  onHelpOpenChange: (open: boolean | ((prev: boolean) => boolean)) => void;
  onRegisterFocusGrid: (focus: (() => void) | null) => void;
  urlFocus: YearViewUrlFocus | null;
  shouldApplyUrlFocus: (focus: YearViewUrlFocus | null) => boolean;
  markUrlFocusApplied: (focus: YearViewUrlFocus) => void;
  onUrlFocusChange: (focus: YearViewUrlFocus, options?: { replace?: boolean }) => void;
  onYearNavigate: (year: number, cell: KeyboardCell, detailsOpen: boolean) => void;
};

export function useYearGridKeyboard({
  year,
  months,
  monthNames,
  events,
  scrollRef,
  monthHeaderRefs,
  rowHeight,
  focusTodaySignal,
  todayCell,
  helpOpen,
  commandPaletteOpen,
  mutationDialogOpen,
  canModifyEvent,
  onRequestCreateEvent,
  onRequestEditEvent,
  onRequestDeleteEvent,
  onHelpOpenChange,
  onRegisterFocusGrid,
  urlFocus,
  shouldApplyUrlFocus,
  markUrlFocusApplied,
  onUrlFocusChange,
  onYearNavigate,
}: UseYearGridKeyboardArgs) {
  const [activeCell, setActiveCell] = useState<KeyboardCell>(urlFocus?.cell ?? todayCell);
  const [dialogCell, setDialogCell] = useState<KeyboardCell | null>(
    urlFocus?.detailsOpen ? urlFocus.cell : null,
  );
  const [dialogActiveKey, setDialogActiveKey] = useState<string | undefined>();
  const [announcement, setAnnouncement] = useState("");
  const [dateChangePreview, setDateChangePreview] = useState<KeyboardCell | null>(null);
  const localFocusSignatureRef = useRef<string>(
    focusSignature({
      cell: urlFocus?.cell ?? todayCell,
      detailsOpen: urlFocus?.detailsOpen ?? false,
    }),
  );
  const dayTypeaheadBufferRef = useRef("");
  const dayTypeaheadTimeoutRef = useRef<number | null>(null);
  const monthTypeaheadBufferRef = useRef("");
  const monthTypeaheadTimeoutRef = useRef<number | null>(null);
  const dateChangePreviewTimeoutRef = useRef<number | null>(null);

  const clearDateChangePreview = useCallback(() => {
    if (dateChangePreviewTimeoutRef.current !== null) {
      window.clearTimeout(dateChangePreviewTimeoutRef.current);
      // eslint-disable-next-line functional/immutable-data
      dateChangePreviewTimeoutRef.current = null;
    }
    setDateChangePreview(null);
  }, []);

  const showDateChangePreview = useCallback(
    (cell: KeyboardCell, duration = DATE_CHANGE_FEEDBACK_MS) => {
      clearDateChangePreview();
      setDateChangePreview(cell);
      // eslint-disable-next-line functional/immutable-data
      dateChangePreviewTimeoutRef.current = window.setTimeout(() => {
        clearDateChangePreview();
      }, duration);
    },
    [clearDateChangePreview],
  );

  const clearDayTypeahead = useCallback(() => {
    if (dayTypeaheadTimeoutRef.current !== null) {
      window.clearTimeout(dayTypeaheadTimeoutRef.current);
      // eslint-disable-next-line functional/immutable-data
      dayTypeaheadTimeoutRef.current = null;
    }
    // eslint-disable-next-line functional/immutable-data
    dayTypeaheadBufferRef.current = "";
  }, []);

  const clearMonthTypeahead = useCallback(() => {
    if (monthTypeaheadTimeoutRef.current !== null) {
      window.clearTimeout(monthTypeaheadTimeoutRef.current);
      // eslint-disable-next-line functional/immutable-data
      monthTypeaheadTimeoutRef.current = null;
    }
    // eslint-disable-next-line functional/immutable-data
    monthTypeaheadBufferRef.current = "";
  }, []);

  const rememberLocalFocus = useCallback((cell: KeyboardCell, detailsOpen: boolean) => {
    // eslint-disable-next-line functional/immutable-data
    localFocusSignatureRef.current = focusSignature({ cell, detailsOpen });
  }, []);

  const dialogItems = useMemo(() => {
    if (!dialogCell) return [];
    const month = months.find((entry) => entry.month === dialogCell.month);
    if (!month) return [];
    return getOrderedDayEvents(month, events, dialogCell.day);
  }, [dialogCell, events, months]);

  const activeEvent =
    dialogItems.find((item) => item.key === dialogActiveKey) ?? dialogItems[0] ?? null;

  const announceCell = useCallback(
    (cell: KeyboardCell, panelOpen: boolean) => {
      const monthLabel = monthNames[cell.month] ?? "";
      setAnnouncement(
        panelOpen ? `${monthLabel} ${cell.day}, day details open` : `${monthLabel} ${cell.day}`,
      );
    },
    [monthNames],
  );

  const announceEvent = useCallback((title: string) => {
    setAnnouncement(title);
  }, []);

  const focusGrid = useCallback(() => {
    scrollRef.current?.focus({ preventScroll: true });
  }, [scrollRef]);

  useEffect(() => {
    onRegisterFocusGrid(focusGrid);
    return () => onRegisterFocusGrid(null);
  }, [focusGrid, onRegisterFocusGrid]);

  const syncUrl = useCallback(
    (cell: KeyboardCell, detailsOpen: boolean, replace = true) => {
      rememberLocalFocus(cell, detailsOpen);
      onUrlFocusChange({ cell, detailsOpen }, { replace });
    },
    [onUrlFocusChange, rememberLocalFocus],
  );

  useEffect(() => {
    if (!urlFocus || !shouldApplyUrlFocus(urlFocus)) return;

    const incomingSignature = focusSignature(urlFocus);
    if (incomingSignature === localFocusSignatureRef.current) {
      markUrlFocusApplied(urlFocus);
      return;
    }

    setActiveCell(urlFocus.cell);
    setDialogCell(urlFocus.detailsOpen ? urlFocus.cell : null);
    rememberLocalFocus(urlFocus.cell, urlFocus.detailsOpen);
    markUrlFocusApplied(urlFocus);
  }, [markUrlFocusApplied, rememberLocalFocus, shouldApplyUrlFocus, urlFocus]);

  const closeDialog = useCallback(() => {
    setDialogCell(null);
    setDialogActiveKey(undefined);
    syncUrl(activeCell, false);
    focusGrid();
  }, [activeCell, focusGrid, syncUrl]);

  const openDialog = useCallback(
    (cell: KeyboardCell) => {
      setActiveCell(cell);
      setDialogCell(cell);
      syncUrl(cell, true);
      announceCell(cell, true);
      showDateChangePreview(cell);
    },
    [announceCell, showDateChangePreview, syncUrl],
  );

  const openDayDetails = useCallback(
    (cell: KeyboardCell) => {
      openDialog(clampCell(cell, year));
    },
    [openDialog, year],
  );

  const toggleDialog = useCallback(
    (cell: KeyboardCell) => {
      if (dialogCell?.month === cell.month && dialogCell.day === cell.day) {
        closeDialog();
        return;
      }
      openDialog(cell);
    },
    [closeDialog, dialogCell, openDialog],
  );

  useEffect(() => {
    if (focusTodaySignal === 0) return;
    setActiveCell(todayCell);
    setDialogCell(null);
    setDialogActiveKey(undefined);
    rememberLocalFocus(todayCell, false);
    onHelpOpenChange(false);
    showDateChangePreview(todayCell);
  }, [focusTodaySignal, onHelpOpenChange, rememberLocalFocus, showDateChangePreview, todayCell]);

  useEffect(() => {
    focusGrid();
  }, [focusGrid]);

  useEffect(() => {
    if (!dialogCell) {
      setDialogActiveKey(undefined);
      return;
    }
    const nextKey = dialogItems[0]?.key;
    setDialogActiveKey(nextKey);
    if (nextKey) {
      const item = dialogItems.find((entry) => entry.key === nextKey);
      if (item) announceEvent(item.event.title);
    }
  }, [announceEvent, dialogCell, dialogItems]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const monthHeader = monthHeaderRefs.current[activeCell.month];
    if (monthHeader) {
      const left = monthHeader.offsetLeft - (container.clientWidth - monthHeader.offsetWidth) / 2;
      container.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    }

    const rowTop = (activeCell.day - 1) * rowHeight;
    const headerHeight = YEAR_GRID_HEADER_HEIGHT;
    if (rowTop < container.scrollTop + headerHeight) {
      container.scrollTo({ top: Math.max(0, rowTop - headerHeight), behavior: "smooth" });
    } else if (rowTop + rowHeight > container.scrollTop + container.clientHeight) {
      container.scrollTo({
        top: rowTop + rowHeight - container.clientHeight,
        behavior: "smooth",
      });
    }
  }, [activeCell, monthHeaderRefs, rowHeight, scrollRef]);

  const moveActiveCell = useCallback(
    (move: (cell: KeyboardCell) => KeyboardCell, keepDialog = false) => {
      const next = clampCell(move(activeCell), year);
      setActiveCell(next);
      announceCell(next, keepDialog);
      showDateChangePreview(next);
      if (keepDialog) {
        setDialogCell(next);
        syncUrl(next, true);
      } else {
        setDialogCell(null);
        setDialogActiveKey(undefined);
        syncUrl(next, false);
      }
    },
    [activeCell, announceCell, showDateChangePreview, syncUrl, year],
  );

  const jumpToDay = useCallback(
    (day: number, keepDialog = false) => {
      moveActiveCell(() => ({ month: activeCell.month, day }), keepDialog);
    },
    [activeCell.month, moveActiveCell],
  );

  const schedulePendingDayJump = useCallback(
    (day: number, keepDialog: boolean) => {
      if (dayTypeaheadTimeoutRef.current !== null) {
        window.clearTimeout(dayTypeaheadTimeoutRef.current);
      }
      showDateChangePreview({ month: activeCell.month, day }, DAY_TYPEAHEAD_COMMIT_DELAY_MS);
      setAnnouncement(`Day ${day}`);
      // eslint-disable-next-line functional/immutable-data
      dayTypeaheadTimeoutRef.current = window.setTimeout(() => {
        clearDayTypeahead();
        jumpToDay(day, keepDialog);
      }, DAY_TYPEAHEAD_COMMIT_DELAY_MS);
    },
    [activeCell.month, clearDayTypeahead, jumpToDay, showDateChangePreview],
  );

  const showCommittedDayFeedback = useCallback(
    (day: number) => {
      if (dayTypeaheadTimeoutRef.current !== null) {
        window.clearTimeout(dayTypeaheadTimeoutRef.current);
      }
      // eslint-disable-next-line functional/immutable-data
      dayTypeaheadBufferRef.current = "";
      showDateChangePreview({ month: activeCell.month, day }, DAY_TYPEAHEAD_FEEDBACK_MS);
      setAnnouncement(`Day ${day}`);
      // eslint-disable-next-line functional/immutable-data
      dayTypeaheadTimeoutRef.current = window.setTimeout(() => {
        clearDayTypeahead();
      }, DAY_TYPEAHEAD_FEEDBACK_MS);
    },
    [activeCell.month, clearDayTypeahead, showDateChangePreview],
  );

  // Shift+number jumps to a month (1–12), keeping the active day clamped into
  // the destination month. Mirrors the day typeahead's commit/pending flow.
  const jumpToMonth = useCallback(
    (month: number, keepDialog: boolean) => {
      moveActiveCell((cell) => ({ month: month - 1, day: cell.day }), keepDialog);
    },
    [moveActiveCell],
  );

  const schedulePendingMonthJump = useCallback(
    (month: number, keepDialog: boolean) => {
      if (monthTypeaheadTimeoutRef.current !== null) {
        window.clearTimeout(monthTypeaheadTimeoutRef.current);
      }
      showDateChangePreview(
        { month: month - 1, day: activeCell.day },
        DAY_TYPEAHEAD_COMMIT_DELAY_MS,
      );
      setAnnouncement(monthNames[month - 1] ?? `Month ${month}`);
      // eslint-disable-next-line functional/immutable-data
      monthTypeaheadTimeoutRef.current = window.setTimeout(() => {
        clearMonthTypeahead();
        jumpToMonth(month, keepDialog);
      }, DAY_TYPEAHEAD_COMMIT_DELAY_MS);
    },
    [activeCell.day, clearMonthTypeahead, jumpToMonth, monthNames, showDateChangePreview],
  );

  const showCommittedMonthFeedback = useCallback(
    (month: number) => {
      if (monthTypeaheadTimeoutRef.current !== null) {
        window.clearTimeout(monthTypeaheadTimeoutRef.current);
      }
      // eslint-disable-next-line functional/immutable-data
      monthTypeaheadBufferRef.current = "";
      showDateChangePreview({ month: month - 1, day: activeCell.day }, DAY_TYPEAHEAD_FEEDBACK_MS);
      setAnnouncement(monthNames[month - 1] ?? `Month ${month}`);
      // eslint-disable-next-line functional/immutable-data
      monthTypeaheadTimeoutRef.current = window.setTimeout(() => {
        clearMonthTypeahead();
      }, DAY_TYPEAHEAD_FEEDBACK_MS);
    },
    [activeCell.day, clearMonthTypeahead, monthNames, showDateChangePreview],
  );

  const cycleDialogEvent = useCallback(
    (delta: number) => {
      if (dialogItems.length === 0) return;
      setDialogActiveKey((current) => {
        const index = dialogItems.findIndex((item) => item.key === current);
        const resolvedIndex = index === -1 ? 0 : index;
        const nextIndex = (resolvedIndex + delta + dialogItems.length) % dialogItems.length;
        const nextItem = dialogItems[nextIndex];
        if (nextItem) announceEvent(nextItem.event.title);
        return nextItem?.key;
      });
    },
    [announceEvent, dialogItems],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const dayPanelOpen = dialogCell !== null;

      // Delete the selected event from day details with Cmd/Ctrl + Backspace/Delete.
      if (
        (event.metaKey || event.ctrlKey) &&
        (event.key === "Backspace" || event.key === "Delete")
      ) {
        if (
          dayPanelOpen &&
          activeEvent &&
          canModifyEvent(activeEvent.event) &&
          shouldHandleGridKeys(event.target, dayPanelOpen)
        ) {
          event.preventDefault();
          onRequestDeleteEvent(activeEvent.event);
        }
        return;
      }

      if (event.ctrlKey || event.metaKey) return;
      if (helpOpen || commandPaletteOpen || mutationDialogOpen) return;

      const arrowStep = resolveArrowMoveStep(event);

      if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
        if (!shouldHandleGridKeys(event.target, dayPanelOpen)) return;
        event.preventDefault();
        onHelpOpenChange((open) => !open);
        return;
      }

      if (!shouldHandleGridKeys(event.target, dayPanelOpen)) return;

      // Shift+number navigates to a month (1–12). Read the digit from the
      // physical key code so Shift+1 (which reports key "!") still resolves to
      // "1". Months share the day typeahead parser with a max of 12.
      const monthDigit = event.shiftKey && !event.altKey ? digitFromKeyboardCode(event.code) : null;
      const monthTypeahead = monthDigit
        ? resolveDayTypeaheadInput({
            buffer: monthTypeaheadBufferRef.current,
            key: monthDigit,
            maxDay: 12,
          })
        : null;
      if (monthTypeahead) {
        event.preventDefault();
        if (monthTypeahead.commitDay !== null) {
          jumpToMonth(monthTypeahead.commitDay, dayPanelOpen);
          showCommittedMonthFeedback(monthTypeahead.commitDay);
        }

        if (monthTypeahead.pendingDay !== null) {
          // eslint-disable-next-line functional/immutable-data
          monthTypeaheadBufferRef.current = monthTypeahead.nextBuffer;
          schedulePendingMonthJump(monthTypeahead.pendingDay, dayPanelOpen);
        } else if (monthTypeahead.commitDay === null) {
          clearMonthTypeahead();
        }
        return;
      }

      const dayTypeahead =
        event.altKey || event.shiftKey
          ? null
          : resolveDayTypeaheadInput({
              buffer: dayTypeaheadBufferRef.current,
              key: event.key,
              maxDay: daysInMonth(year, activeCell.month),
            });
      if (dayTypeahead) {
        event.preventDefault();
        if (dayTypeahead.commitDay !== null) {
          jumpToDay(dayTypeahead.commitDay, dayPanelOpen);
          showCommittedDayFeedback(dayTypeahead.commitDay);
        }

        if (dayTypeahead.pendingDay !== null) {
          // eslint-disable-next-line functional/immutable-data
          dayTypeaheadBufferRef.current = dayTypeahead.nextBuffer;
          schedulePendingDayJump(dayTypeahead.pendingDay, dayPanelOpen);
        } else if (dayTypeahead.commitDay === null) {
          clearDayTypeahead();
        }
        return;
      }

      clearDayTypeahead();
      clearMonthTypeahead();

      // N quick-adds an event on the active day (works whether or not the day
      // panel is open).
      if (event.key.toLowerCase() === "n" && !event.altKey) {
        event.preventDefault();
        onRequestCreateEvent(activeCell);
        return;
      }

      // E edits the selected event when day details are open.
      if (
        event.key.toLowerCase() === "e" &&
        !event.altKey &&
        dayPanelOpen &&
        activeEvent &&
        canModifyEvent(activeEvent.event)
      ) {
        event.preventDefault();
        onRequestEditEvent(activeEvent.event);
        return;
      }

      if (event.key === "Escape") {
        if (dayPanelOpen) {
          event.preventDefault();
          closeDialog();
        }
        return;
      }

      if (dayPanelOpen && (event.key === "[" || event.key === "]")) {
        event.preventDefault();
        cycleDialogEvent(event.key === "[" ? -1 : 1);
        return;
      }

      if (dayPanelOpen && dialogItems.length > 0 && arrowStep && !event.shiftKey && !event.altKey) {
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          event.preventDefault();
          cycleDialogEvent(-1);
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          event.preventDefault();
          cycleDialogEvent(1);
          return;
        }
      }

      if (arrowStep) {
        event.preventDefault();

        if (arrowStep.yearDelta !== 0) {
          const nextYear = Math.min(MAX_YEAR, Math.max(MIN_YEAR, year + arrowStep.yearDelta));
          const nextCell = clampCell(activeCell, nextYear);
          rememberLocalFocus(nextCell, dayPanelOpen);
          setActiveCell(nextCell);
          showDateChangePreview(nextCell);
          if (dayPanelOpen) {
            setDialogCell(nextCell);
          } else {
            setDialogCell(null);
            setDialogActiveKey(undefined);
          }
          announceCell(nextCell, dayPanelOpen);
          onYearNavigate(nextYear, nextCell, dayPanelOpen);
          return;
        }

        moveActiveCell(() => applyArrowMoveStep(activeCell, arrowStep, year), dayPanelOpen);
        return;
      }

      if (event.key === "Home") {
        event.preventDefault();
        moveActiveCell(() => firstDayOfMonth(activeCell), dayPanelOpen);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        moveActiveCell(() => lastDayOfMonth(activeCell, year), dayPanelOpen);
        return;
      }
      if (event.key === "PageUp") {
        event.preventDefault();
        moveActiveCell((cell) => moveCellByDays(cell, -7, year), dayPanelOpen);
        return;
      }
      if (event.key === "PageDown") {
        event.preventDefault();
        moveActiveCell((cell) => moveCellByDays(cell, 7, year), dayPanelOpen);
        return;
      }

      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        toggleDialog(activeCell);
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        if (dayPanelOpen) {
          if (activeEvent) openEventInGoogle(activeEvent.event);
          return;
        }
        if (event.shiftKey) {
          openDayInGoogleCalendar(year, activeCell.month, activeCell.day);
          return;
        }
        openDialog(activeCell);
      }
    },
    [
      activeCell,
      activeEvent,
      announceCell,
      canModifyEvent,
      closeDialog,
      clearDayTypeahead,
      clearMonthTypeahead,
      commandPaletteOpen,
      cycleDialogEvent,
      dialogCell,
      dialogItems.length,
      helpOpen,
      jumpToDay,
      jumpToMonth,
      moveActiveCell,
      mutationDialogOpen,
      onHelpOpenChange,
      onRequestCreateEvent,
      onRequestEditEvent,
      onRequestDeleteEvent,
      onYearNavigate,
      openDialog,
      rememberLocalFocus,
      schedulePendingDayJump,
      schedulePendingMonthJump,
      showDateChangePreview,
      showCommittedDayFeedback,
      showCommittedMonthFeedback,
      toggleDialog,
      year,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(
    () => () => {
      clearDayTypeahead();
      clearMonthTypeahead();
      clearDateChangePreview();
    },
    [clearDateChangePreview, clearDayTypeahead, clearMonthTypeahead],
  );

  return {
    activeCell,
    dialogCell,
    dialogActiveKey,
    setDialogActiveKey,
    announcement,
    dateChangePreview,
    focusGrid,
    closeDialog,
    openDayDetails,
  };
}
