import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import AppShell from "@/components/app-shell";
import { TooltipProvider } from "@/components/tooltip";
import { useYearViewState } from "@/components/use-year-view-state";
import { ROW_HEIGHT } from "@/components/year-helpers";
import YearViewSidebar from "@/components/year-view/year-view-sidebar";
import YearViewTopBar from "@/components/year-view/year-view-top-bar";
import { YearViewProvider } from "@/components/year-view/year-view-context";
import { useYearViewDerivedData } from "@/components/year-view/use-year-view-derived-data";
import { useYearViewViewport } from "@/components/year-view/use-year-view-viewport";
import { useYearViewUrlSync } from "@/components/year-view/use-year-view-url-sync";
import YearGrid from "@/components/year-view/year-grid";
import { useYearViewData } from "@/components/year-view/use-year-view-data";
import { clampCell, type KeyboardCell } from "@/components/year-view/year-grid-keyboard";
import EventFormDialog from "@/components/year-view/event-form-dialog";
import DeleteEventDialog from "@/components/year-view/delete-event-dialog";
import { MAX_YEAR, MIN_YEAR } from "@/components/year-view/constants";
import { YearRefreshNotice } from "@/components/year-view/shared-components";
import type { YearViewInitialData } from "@/components/year-view/types";
import type { CalendarEvent } from "@/domain";
import {
  createEvent,
  deleteEvent,
  updateEvent,
  getDefaultWritableCalendar,
  isWritableCalendar,
} from "@/lib/google-calendar";
import { useI18n } from "@/i18n/context";
import { useSearch } from "@/lib/router";
import {
  getStoredSidebarCollapsedPreference,
  storeSidebarCollapsedPreference,
} from "@/lib/year-view-preferences";
import { nextThemeMode } from "@/lib/theme";

function isTextInputTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export default function YearView({
  initialYear,
  initialData = null,
}: {
  initialYear: number;
  initialData?: YearViewInitialData | null;
}) {
  const search = useSearch({ from: "/year/$year" });
  const { formatDate } = useI18n();
  const { setTheme, theme } = useTheme();

  const {
    dispatch: yearViewDispatch,
    year,
    setYear,
    calendars,
    setCalendars,
    selectedCalendarIds,
    setSelectedCalendarIds,
    events,
    setEvents,
    loading,
    setLoading,
    hasHydratedData,
    setHasHydratedData,
    isRefreshing,
    setIsRefreshing,
    error,
    setError,
    calendarLoading,
    scrollEdges,
    setScrollEdges,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
  } = useYearViewState({
    year: initialYear,
    calendars: initialData?.calendars,
    selectedCalendarIds: initialData?.selectedCalendarIds,
    events: initialData?.events,
    loading: initialData == null,
    hasHydratedData: initialData != null,
  });

  const hasLoadedSidebarPreferenceRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const monthHeaderRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rowsRef = useRef<HTMLDivElement | null>(null);
  const rowHeight = ROW_HEIGHT;
  const [jumpDayHighlight, setJumpDayHighlight] = useState<number | null>(null);
  const [focusTodaySignal, setFocusTodaySignal] = useState(0);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickAddCell, setQuickAddCell] = useState<KeyboardCell | null>(null);
  const [quickAddSubmitting, setQuickAddSubmitting] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<CalendarEvent | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CalendarEvent | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const focusYearGridRef = useRef<(() => void) | null>(null);
  const registerFocusYearGrid = useCallback((focus: (() => void) | null) => {
    // eslint-disable-next-line functional/immutable-data
    focusYearGridRef.current = focus;
  }, []);
  const focusYearGrid = useCallback(() => {
    focusYearGridRef.current?.();
  }, []);

  const { urlFocus, navigateYearView, shouldApplyUrlFocus, markUrlFocusApplied } =
    useYearViewUrlSync(year, search);

  useEffect(() => {
    if (year !== initialYear) {
      setYear(initialYear);
    }
  }, [initialYear, setYear, year]);

  const defaultCell = useCallback(
    (targetYear: number) =>
      urlFocus?.cell ??
      clampCell(
        {
          month: targetYear === new Date().getFullYear() ? new Date().getMonth() : 0,
          day: targetYear === new Date().getFullYear() ? new Date().getDate() : 1,
        },
        targetYear,
      ),
    [urlFocus?.cell],
  );

  const onUrlFocusChange = useCallback(
    (
      focus: { cell: { month: number; day: number }; detailsOpen: boolean },
      options?: { replace?: boolean },
    ) => {
      navigateYearView({ year, cell: focus.cell, detailsOpen: focus.detailsOpen }, options);
    },
    [navigateYearView, year],
  );

  const onYearNavigate = useCallback(
    (targetYear: number, cell: { month: number; day: number }, detailsOpen: boolean) => {
      navigateYearView({ year: targetYear, cell, detailsOpen }, { replace: false });
    },
    [navigateYearView],
  );

  const { scrollToMonth } = useYearViewViewport({
    scrollRef,
    monthHeaderRefs,
    setScrollEdges,
    monthsLength: 12,
    search,
    year,
    setJumpDayHighlight,
  });

  const handleYearChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (Number.isNaN(value)) return;
      setYear(value);
      if (value >= MIN_YEAR && value <= MAX_YEAR && value !== initialYear) {
        navigateYearView(
          {
            year: value,
            cell: defaultCell(value),
            detailsOpen: false,
          },
          { replace: false },
        );
      }
    },
    [defaultCell, initialYear, navigateYearView, setYear],
  );

  const handleYearKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        const nextYear = Math.min(MAX_YEAR, year + 1);
        navigateYearView(
          { year: nextYear, cell: defaultCell(nextYear), detailsOpen: false },
          { replace: false },
        );
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        const nextYear = Math.max(MIN_YEAR, year - 1);
        navigateYearView(
          { year: nextYear, cell: defaultCell(nextYear), detailsOpen: false },
          { replace: false },
        );
      }
    },
    [defaultCell, navigateYearView, year],
  );

  const handlePreviousYear = useCallback(() => {
    navigateYearView(
      { year: year - 1, cell: defaultCell(year - 1), detailsOpen: false },
      { replace: false },
    );
  }, [defaultCell, navigateYearView, year]);

  const handleNextYear = useCallback(() => {
    navigateYearView(
      { year: year + 1, cell: defaultCell(year + 1), detailsOpen: false },
      { replace: false },
    );
  }, [defaultCell, navigateYearView, year]);

  const handleMonthSelect = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const nextMonth = Number(event.target.value);
      if (Number.isNaN(nextMonth)) return;
      scrollToMonth(nextMonth);
      navigateYearView(
        {
          cell: clampCell({ month: nextMonth, day: urlFocus?.cell.day ?? 1 }, year),
          detailsOpen: false,
        },
        { replace: true },
      );
    },
    [navigateYearView, scrollToMonth, urlFocus?.cell.day, year],
  );

  const handleToggleSidebar = useCallback(() => {
    const next = !sidebarCollapsed;
    setSidebarCollapsed(next);
    storeSidebarCollapsedPreference(next);
  }, [setSidebarCollapsed, sidebarCollapsed]);

  const handleOpenMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(true);
  }, [setMobileSidebarOpen]);

  const handleJumpToToday = useCallback(() => {
    const today = new Date();
    navigateYearView(
      {
        year: today.getFullYear(),
        cell: clampCell({ month: today.getMonth(), day: today.getDate() }, today.getFullYear()),
        detailsOpen: false,
      },
      { replace: false },
    );
    scrollToMonth(today.getMonth());
    setFocusTodaySignal((value) => value + 1);
  }, [navigateYearView, scrollToMonth]);

  useEffect(() => {
    const collapsed = getStoredSidebarCollapsedPreference();
    yearViewDispatch({ type: "SET_SIDEBAR_COLLAPSED", payload: collapsed });
    // eslint-disable-next-line functional/immutable-data
    hasLoadedSidebarPreferenceRef.current = true;
  }, [yearViewDispatch]);

  const {
    displayEventMap,
    monthNames,
    months,
    syncBadge,
    todayLongLabel,
    unresolvedSelectedCalendarIds,
    visibleEvents,
  } = useYearViewDerivedData({
    calendars,
    events,
    formatDate,
    isRefreshing,
    selectedCalendarIds,
    year,
  });

  const { loadData, updateSelectedCalendars, handleReloadCalendars } = useYearViewData({
    year,
    initialYear,
    initialData,
    calendars,
    setEvents,
    setLoading,
    setIsRefreshing,
    setError,
    setHasHydratedData,
    setCalendars,
    setSelectedCalendarIds,
  });

  const handleRefresh = useCallback(() => {
    void loadData(year);
  }, [loadData, year]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isTextInputTarget(event.target)) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((open) => !open);
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey) return;

      const key = event.key.toLowerCase();
      if (key === "s") {
        event.preventDefault();
        handleToggleSidebar();
        return;
      }

      if (key === "r") {
        event.preventDefault();
        handleRefresh();
        return;
      }

      if (key !== "t") return;

      event.preventDefault();
      if (event.shiftKey) {
        setTheme(nextThemeMode(theme));
        return;
      }

      handleJumpToToday();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleJumpToToday, handleRefresh, handleToggleSidebar, setTheme, theme]);

  const mutationDialogOpen = quickAddCell !== null || editTarget !== null || deleteTarget !== null;

  const canModifyEvent = useCallback(
    (event: CalendarEvent) =>
      isWritableCalendar(calendars.find((calendar) => calendar.id === event.calendarId)),
    [calendars],
  );

  const onRequestCreateEvent = useCallback((cell: KeyboardCell) => {
    setQuickAddError(null);
    setQuickAddCell(cell);
  }, []);

  const onRequestEditEvent = useCallback((event: CalendarEvent) => {
    setEditError(null);
    setEditTarget(event);
  }, []);

  const onRequestDeleteEvent = useCallback((event: CalendarEvent) => {
    setDeleteError(null);
    setDeleteTarget(event);
  }, []);

  const handleQuickAddOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      setQuickAddCell(null);
      setQuickAddError(null);
      focusYearGrid();
    },
    [focusYearGrid],
  );

  const handleEditOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      setEditTarget(null);
      setEditError(null);
      focusYearGrid();
    },
    [focusYearGrid],
  );

  const handleDeleteOpenChange = useCallback(
    (open: boolean) => {
      if (open) return;
      setDeleteTarget(null);
      setDeleteError(null);
      focusYearGrid();
    },
    [focusYearGrid],
  );

  const targetCalendar = getDefaultWritableCalendar(calendars);

  // Friendly "Month D, YYYY" label from the event's start (date-only or ISO).
  const editDateLabel = (() => {
    if (!editTarget) return "";
    const [y, m, d] = editTarget.start.slice(0, 10).split("-").map(Number);
    if (!y || !m || !d) return "";
    return `${monthNames[m - 1]} ${d}, ${y}`;
  })();

  const handleQuickAddSubmit = useCallback(
    async (title: string) => {
      const cell = quickAddCell;
      if (!cell || !targetCalendar) return;
      const date = `${year}-${String(cell.month + 1).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}`;
      setQuickAddSubmitting(true);
      setQuickAddError(null);
      try {
        const created = await createEvent(targetCalendar, { title, date });
        setEvents((prev) => [...prev, created]);
        setQuickAddCell(null);
        focusYearGrid();
        // Reconcile with Google so colors/ordering match the server copy.
        loadData(year);
      } catch (err) {
        setQuickAddError(err instanceof Error ? err.message : "Failed to create event");
      } finally {
        setQuickAddSubmitting(false);
      }
    },
    [focusYearGrid, loadData, quickAddCell, setEvents, targetCalendar, year],
  );

  const handleEditSubmit = useCallback(
    async (title: string) => {
      const target = editTarget;
      if (!target) return;
      setEditSubmitting(true);
      setEditError(null);
      try {
        await updateEvent(target.calendarId, target.id, { title });
        setEvents((prev) =>
          prev.map((event) => (event.id === target.id ? { ...event, title } : event)),
        );
        setEditTarget(null);
        focusYearGrid();
        loadData(year);
      } catch (err) {
        setEditError(err instanceof Error ? err.message : "Failed to update event");
      } finally {
        setEditSubmitting(false);
      }
    },
    [editTarget, focusYearGrid, loadData, setEvents, year],
  );

  const handleDeleteConfirm = useCallback(async () => {
    const target = deleteTarget;
    if (!target) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    try {
      await deleteEvent(target.calendarId, target.id);
      setEvents((prev) => prev.filter((event) => event.id !== target.id));
      setDeleteTarget(null);
      focusYearGrid();
      loadData(year);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete event");
    } finally {
      setDeleteSubmitting(false);
    }
  }, [deleteTarget, focusYearGrid, loadData, setEvents, year]);

  const yearViewContextValue = useMemo(
    () => ({
      year,
      sidebarCollapsed,
      syncBadge,
      isRefreshing,
      monthNames,
      todayLongLabel,
      calendars,
      selectedCalendarIds,
      keyboardHelpOpen,
      setKeyboardHelpOpen,
      commandPaletteOpen,
      setCommandPaletteOpen,
      registerFocusYearGrid,
      focusYearGrid,
      onYearChange: handleYearChange,
      onYearKeyDown: handleYearKeyDown,
      onPreviousYear: handlePreviousYear,
      onNextYear: handleNextYear,
      onJumpToToday: handleJumpToToday,
      onRefresh: handleRefresh,
      onToggleSidebar: handleToggleSidebar,
      onOpenMobileSidebar: handleOpenMobileSidebar,
      onMonthSelect: handleMonthSelect,
    }),
    [
      year,
      sidebarCollapsed,
      syncBadge,
      isRefreshing,
      monthNames,
      todayLongLabel,
      calendars,
      selectedCalendarIds,
      keyboardHelpOpen,
      setKeyboardHelpOpen,
      commandPaletteOpen,
      setCommandPaletteOpen,
      registerFocusYearGrid,
      focusYearGrid,
      handleYearChange,
      handleYearKeyDown,
      handlePreviousYear,
      handleNextYear,
      handleJumpToToday,
      handleRefresh,
      handleToggleSidebar,
      handleOpenMobileSidebar,
      handleMonthSelect,
    ],
  );

  return (
    <TooltipProvider>
      <YearViewProvider value={yearViewContextValue}>
        <AppShell
          sidebarCollapsed={sidebarCollapsed}
          mobileSidebarOpen={mobileSidebarOpen}
          onMobileSidebarOpenChange={setMobileSidebarOpen}
          topbar={<YearViewTopBar />}
          sidebar={
            <YearViewSidebar
              error={error}
              onRetry={() => {
                setError(null);
                loadData(year);
              }}
              calendarLoading={calendarLoading}
              loading={loading}
              onResync={() => {
                handleReloadCalendars();
              }}
              onChangeCalendars={updateSelectedCalendars}
              visibleEventsCount={visibleEvents.length}
              unresolvedSelectedCalendarIds={unresolvedSelectedCalendarIds}
              onGoogleAuthChange={() => {
                loadData(year);
              }}
            />
          }
        >
          <main
            className="flex h-full w-full flex-1 min-h-0 flex-col"
            aria-label={`Calendar for ${year}`}
          >
            <div className="relative h-full">
              {isRefreshing && hasHydratedData && (
                <div className="pointer-events-none absolute right-4 top-4 z-20">
                  <YearRefreshNotice label="Loading events..." />
                </div>
              )}
              <YearGrid
                months={months}
                events={displayEventMap}
                calendars={calendars}
                year={year}
                scrollRef={scrollRef}
                monthHeaderRefs={monthHeaderRefs}
                scrollEdges={scrollEdges}
                rowsRef={rowsRef}
                rowHeight={rowHeight}
                monthNames={monthNames}
                yearCalendarAriaLabel={`Calendar for ${year}`}
                todayLongLabel={todayLongLabel}
                jumpDayHighlight={jumpDayHighlight}
                focusTodaySignal={focusTodaySignal}
                keyboardHelpOpen={keyboardHelpOpen}
                commandPaletteOpen={commandPaletteOpen}
                mutationDialogOpen={mutationDialogOpen}
                canModifyEvent={canModifyEvent}
                onRequestCreateEvent={onRequestCreateEvent}
                onRequestEditEvent={onRequestEditEvent}
                onRequestDeleteEvent={onRequestDeleteEvent}
                onKeyboardHelpOpenChange={setKeyboardHelpOpen}
                onRegisterFocusYearGrid={registerFocusYearGrid}
                urlFocus={urlFocus}
                shouldApplyUrlFocus={shouldApplyUrlFocus}
                markUrlFocusApplied={markUrlFocusApplied}
                onUrlFocusChange={onUrlFocusChange}
                onYearNavigate={onYearNavigate}
              />
            </div>
          </main>
        </AppShell>
        <EventFormDialog
          open={quickAddCell !== null}
          mode="create"
          dateLabel={
            quickAddCell ? `${monthNames[quickAddCell.month]} ${quickAddCell.day}, ${year}` : ""
          }
          calendarName={targetCalendar?.summary ?? null}
          submittable={targetCalendar !== null}
          hint="Connect a writable Google calendar to create events."
          submitting={quickAddSubmitting}
          error={quickAddError}
          onSubmit={handleQuickAddSubmit}
          onOpenChange={handleQuickAddOpenChange}
        />
        <EventFormDialog
          open={editTarget !== null}
          mode="edit"
          initialTitle={editTarget?.title ?? ""}
          dateLabel={editDateLabel}
          calendarName={editTarget?.calendarSummary ?? null}
          submittable
          submitting={editSubmitting}
          error={editError}
          onSubmit={handleEditSubmit}
          onOpenChange={handleEditOpenChange}
        />
        <DeleteEventDialog
          open={deleteTarget !== null}
          eventTitle={deleteTarget?.title ?? ""}
          deleting={deleteSubmitting}
          error={deleteError}
          onConfirm={handleDeleteConfirm}
          onOpenChange={handleDeleteOpenChange}
        />
      </YearViewProvider>
    </TooltipProvider>
  );
}
