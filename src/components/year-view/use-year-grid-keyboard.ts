import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { YearViewUrlFocus } from "@/components/year-view/use-year-view-url-sync";
import { getOrderedDayEvents } from "@/components/year-view/use-month-column";
import { useKeepCellInView } from "@/components/year-view/use-keep-cell-in-view";
import { useTypeahead, type TypeaheadSpec } from "@/components/year-view/use-typeahead";
import {
  clampCell,
  firstDayOfMonth,
  lastDayOfMonth,
  moveCellByDays,
  applyArrowMoveStep,
  daysInMonth,
  digitFromKeyboardCode,
  resolveArrowMoveStep,
  shouldHandleGridKeys,
  type KeyboardCell,
} from "@/components/year-view/year-grid-keyboard";
import { MAX_YEAR, MIN_YEAR } from "@/components/year-view/constants";
import { focusSignature } from "@/lib/year-view-url";
import { openDayInGoogleCalendar, openEventInGoogle } from "@/lib/open-event";
import type { CalendarEvent, MonthSegments } from "@/domain";

/** How long the destination cell stays highlighted after a jump. */
const DATE_CHANGE_FEEDBACK_MS = 700;

type UseYearGridKeyboardArgs = {
  year: number;
  months: MonthSegments[];
  monthNames: string[];
  events: Map<string, CalendarEvent>;
  scrollRef: RefObject<HTMLDivElement | null>;
  monthHeaderRefs: RefObject<Array<HTMLDivElement | null>>;
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

/**
 * All keyboard interaction inside the year grid.
 *
 * `handleKeyDown` is a chain of small, named intent handlers rather than one
 * cascade of `if`s. Each returns true once it has claimed the event, and the
 * order they appear in *is* the precedence: the typeaheads must see digits
 * before the letter shortcuts do, and the day-details dialog must claim arrow
 * keys before they move the cursor.
 */
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
  const dateChangePreviewTimeoutRef = useRef<number | null>(null);

  // ---------------------------------------------------------------------------
  // Feedback
  // ---------------------------------------------------------------------------

  const clearDateChangePreview = useCallback(() => {
    if (dateChangePreviewTimeoutRef.current !== null) {
      window.clearTimeout(dateChangePreviewTimeoutRef.current);
      dateChangePreviewTimeoutRef.current = null;
    }
    setDateChangePreview(null);
  }, []);

  const showDateChangePreview = useCallback(
    (cell: KeyboardCell, duration = DATE_CHANGE_FEEDBACK_MS) => {
      clearDateChangePreview();
      setDateChangePreview(cell);
      dateChangePreviewTimeoutRef.current = window.setTimeout(clearDateChangePreview, duration);
    },
    [clearDateChangePreview],
  );

  useEffect(() => clearDateChangePreview, [clearDateChangePreview]);

  const announceCell = useCallback(
    (cell: KeyboardCell, panelOpen: boolean) => {
      const monthLabel = monthNames[cell.month] ?? "";
      setAnnouncement(
        panelOpen ? `${monthLabel} ${cell.day}, day details open` : `${monthLabel} ${cell.day}`,
      );
    },
    [monthNames],
  );

  const announceEvent = useCallback((title: string) => setAnnouncement(title), []);

  // ---------------------------------------------------------------------------
  // Focus and URL
  // ---------------------------------------------------------------------------

  const focusGrid = useCallback(() => {
    scrollRef.current?.focus({ preventScroll: true });
  }, [scrollRef]);

  useEffect(() => {
    onRegisterFocusGrid(focusGrid);
    return () => onRegisterFocusGrid(null);
  }, [focusGrid, onRegisterFocusGrid]);

  useEffect(() => {
    focusGrid();
  }, [focusGrid]);

  const rememberLocalFocus = useCallback((cell: KeyboardCell, detailsOpen: boolean) => {
    localFocusSignatureRef.current = focusSignature({ cell, detailsOpen });
  }, []);

  const syncUrl = useCallback(
    (cell: KeyboardCell, detailsOpen: boolean, replace = true) => {
      rememberLocalFocus(cell, detailsOpen);
      onUrlFocusChange({ cell, detailsOpen }, { replace });
    },
    [onUrlFocusChange, rememberLocalFocus],
  );

  // Adopt focus arriving from the URL, unless it is the echo of a move we just
  // made ourselves — otherwise the two would trade updates forever.
  useEffect(() => {
    if (!urlFocus || !shouldApplyUrlFocus(urlFocus)) return;

    if (focusSignature(urlFocus) === localFocusSignatureRef.current) {
      markUrlFocusApplied(urlFocus);
      return;
    }

    setActiveCell(urlFocus.cell);
    setDialogCell(urlFocus.detailsOpen ? urlFocus.cell : null);
    rememberLocalFocus(urlFocus.cell, urlFocus.detailsOpen);
    markUrlFocusApplied(urlFocus);
  }, [markUrlFocusApplied, rememberLocalFocus, shouldApplyUrlFocus, urlFocus]);

  useKeepCellInView({ cell: activeCell, scrollRef, monthHeaderRefs, rowHeight });

  // ---------------------------------------------------------------------------
  // Day details dialog
  // ---------------------------------------------------------------------------

  const dialogItems = useMemo(() => {
    if (!dialogCell) return [];
    const month = months.find((entry) => entry.month === dialogCell.month);
    if (!month) return [];
    return getOrderedDayEvents(month, events, dialogCell.day);
  }, [dialogCell, events, months]);

  const activeEvent =
    dialogItems.find((item) => item.key === dialogActiveKey) ?? dialogItems[0] ?? null;

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
    (cell: KeyboardCell, eventKey?: string) => {
      setDialogActiveKey(eventKey);
      openDialog(clampCell(cell, year));
    },
    [openDialog, year],
  );

  const toggleDialog = useCallback(
    (cell: KeyboardCell) => {
      if (dialogCell?.month === cell.month && dialogCell.day === cell.day) closeDialog();
      else openDialog(cell);
    },
    [closeDialog, dialogCell, openDialog],
  );

  // Opening a day selects its first event, so Enter and E have a target.
  useEffect(() => {
    if (!dialogCell) {
      setDialogActiveKey(undefined);
      return;
    }
    setDialogActiveKey((current) => {
      const nextKey = dialogItems.some((item) => item.key === current)
        ? current
        : dialogItems[0]?.key;
      return nextKey;
    });
  }, [announceEvent, dialogCell, dialogItems]);

  useEffect(() => {
    if (activeEvent) announceEvent(activeEvent.event.title);
  }, [activeEvent, announceEvent]);

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

  useEffect(() => {
    if (focusTodaySignal === 0) return;
    setActiveCell(todayCell);
    setDialogCell(null);
    setDialogActiveKey(undefined);
    rememberLocalFocus(todayCell, false);
    onHelpOpenChange(false);
    showDateChangePreview(todayCell);
  }, [focusTodaySignal, onHelpOpenChange, rememberLocalFocus, showDateChangePreview, todayCell]);

  // ---------------------------------------------------------------------------
  // Movement
  // ---------------------------------------------------------------------------

  const moveActiveCell = useCallback(
    (move: (cell: KeyboardCell) => KeyboardCell, keepDialog = false) => {
      const next = clampCell(move(activeCell), year);
      setActiveCell(next);
      announceCell(next, keepDialog);
      showDateChangePreview(next);
      if (keepDialog) {
        setDialogCell(next);
      } else {
        setDialogCell(null);
        setDialogActiveKey(undefined);
      }
      syncUrl(next, keepDialog);
    },
    [activeCell, announceCell, showDateChangePreview, syncUrl, year],
  );

  const dayTypeahead = useTypeahead({
    showPreview: showDateChangePreview,
    announce: setAnnouncement,
  });
  const monthTypeahead = useTypeahead({
    showPreview: showDateChangePreview,
    announce: setAnnouncement,
  });

  const daySpec = useMemo<TypeaheadSpec>(
    () => ({
      max: daysInMonth(year, activeCell.month),
      toPreviewCell: (day) => ({ month: activeCell.month, day }),
      toLabel: (day) => `Day ${day}`,
      onCommit: (day, keepDialog) =>
        moveActiveCell(() => ({ month: activeCell.month, day }), keepDialog),
    }),
    [activeCell.month, moveActiveCell, year],
  );

  const monthSpec = useMemo<TypeaheadSpec>(
    () => ({
      max: 12,
      toPreviewCell: (month) => ({ month: month - 1, day: activeCell.day }),
      toLabel: (month) => monthNames[month - 1] ?? `Month ${month}`,
      onCommit: (month, keepDialog) =>
        moveActiveCell((cell) => ({ month: month - 1, day: cell.day }), keepDialog),
    }),
    [activeCell.day, monthNames, moveActiveCell],
  );

  // ---------------------------------------------------------------------------
  // Key dispatch
  // ---------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;

      const dayPanelOpen = dialogCell !== null;
      const claim = () => event.preventDefault();

      // Cmd/Ctrl + Backspace deletes the selected event. Checked before the
      // modifier bail-out below, which is the only reason a chord gets here.
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
          claim();
          onRequestDeleteEvent(activeEvent.event);
        }
        return;
      }

      if (event.ctrlKey || event.metaKey) return;
      // An open overlay owns the keyboard.
      if (helpOpen || commandPaletteOpen || mutationDialogOpen) return;

      if (event.key === "?" || (event.key === "/" && event.shiftKey)) {
        if (!shouldHandleGridKeys(event.target, dayPanelOpen)) return;
        claim();
        onHelpOpenChange((open) => !open);
        return;
      }

      if (!shouldHandleGridKeys(event.target, dayPanelOpen)) return;

      // Shift+digit picks a month. The digit comes from the physical key code
      // because Shift+1 reports its key as "!".
      const monthDigit = event.shiftKey && !event.altKey ? digitFromKeyboardCode(event.code) : null;
      if (monthDigit !== null && monthTypeahead.handleKey(monthDigit, dayPanelOpen, monthSpec)) {
        claim();
        return;
      }

      // A plain digit picks a day in the current month.
      if (
        !event.altKey &&
        !event.shiftKey &&
        dayTypeahead.handleKey(event.key, dayPanelOpen, daySpec)
      ) {
        claim();
        return;
      }

      // Any other key ends a half-typed number rather than letting it commit
      // later on top of wherever the visitor has since moved.
      dayTypeahead.clear();
      monthTypeahead.clear();

      if (event.key.toLowerCase() === "n" && !event.altKey) {
        claim();
        onRequestCreateEvent(activeCell);
        return;
      }

      if (
        event.key.toLowerCase() === "e" &&
        !event.altKey &&
        dayPanelOpen &&
        activeEvent &&
        canModifyEvent(activeEvent.event)
      ) {
        claim();
        onRequestEditEvent(activeEvent.event);
        return;
      }

      if (event.key === "Escape") {
        if (!dayPanelOpen) return;
        claim();
        closeDialog();
        return;
      }

      const arrowStep = resolveArrowMoveStep(event);

      // While a day is open, the arrows and brackets walk its events instead of
      // moving the cursor off the day.
      if (dayPanelOpen && (event.key === "[" || event.key === "]")) {
        claim();
        cycleDialogEvent(event.key === "[" ? -1 : 1);
        return;
      }

      if (dayPanelOpen && dialogItems.length > 0 && arrowStep && !event.shiftKey && !event.altKey) {
        if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
          claim();
          cycleDialogEvent(-1);
          return;
        }
        if (event.key === "ArrowDown" || event.key === "ArrowRight") {
          claim();
          cycleDialogEvent(1);
          return;
        }
      }

      if (arrowStep) {
        claim();

        if (arrowStep.yearDelta !== 0) {
          const nextYear = Math.min(MAX_YEAR, Math.max(MIN_YEAR, year + arrowStep.yearDelta));
          const nextCell = clampCell(activeCell, nextYear);
          rememberLocalFocus(nextCell, dayPanelOpen);
          setActiveCell(nextCell);
          showDateChangePreview(nextCell);
          if (dayPanelOpen) setDialogCell(nextCell);
          else {
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

      const jump = JUMP_KEYS[event.key];
      if (jump) {
        claim();
        moveActiveCell((cell) => jump(cell, year), dayPanelOpen);
        return;
      }

      if (event.key === " " || event.code === "Space") {
        claim();
        toggleDialog(activeCell);
        return;
      }

      if (event.key === "Enter") {
        claim();
        if (dayPanelOpen) {
          if (activeEvent) openEventInGoogle(activeEvent.event);
        } else if (event.shiftKey) {
          openDayInGoogleCalendar(year, activeCell.month, activeCell.day);
        } else {
          openDialog(activeCell);
        }
      }
    },
    [
      activeCell,
      activeEvent,
      announceCell,
      canModifyEvent,
      closeDialog,
      commandPaletteOpen,
      cycleDialogEvent,
      daySpec,
      dayTypeahead,
      dialogCell,
      dialogItems.length,
      helpOpen,
      monthSpec,
      monthTypeahead,
      moveActiveCell,
      mutationDialogOpen,
      onHelpOpenChange,
      onRequestCreateEvent,
      onRequestDeleteEvent,
      onRequestEditEvent,
      onYearNavigate,
      openDialog,
      rememberLocalFocus,
      showDateChangePreview,
      toggleDialog,
      year,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

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

/** Single-press jumps that do not depend on any state beyond the cell and year. */
const JUMP_KEYS: Record<string, ((cell: KeyboardCell, year: number) => KeyboardCell) | undefined> =
  {
    Home: (cell) => firstDayOfMonth(cell),
    End: (cell, year) => lastDayOfMonth(cell, year),
    PageUp: (cell, year) => moveCellByDays(cell, -7, year),
    PageDown: (cell, year) => moveCellByDays(cell, 7, year),
  };
