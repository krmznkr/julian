import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import AppShell from "@/components/app-shell";
import { TooltipProvider } from "@/components/tooltip";
import { ROW_HEIGHT } from "@/components/year-helpers";
import { createInitialState, yearViewReducer } from "@/components/year-view-reducer";
import YearViewSidebar from "@/components/year-view/year-view-sidebar";
import YearViewTopBar from "@/components/year-view/year-view-top-bar";
import { YearViewProvider } from "@/components/year-view/year-view-context";
import { useEventMutations } from "@/components/year-view/use-event-mutations";
import { useYearNavigation } from "@/components/year-view/use-year-navigation";
import { useYearViewDerivedData } from "@/components/year-view/use-year-view-derived-data";
import { useYearViewShortcuts } from "@/components/year-view/use-year-view-shortcuts";
import { useYearViewViewport } from "@/components/year-view/use-year-view-viewport";
import { useYearViewUrlSync } from "@/components/year-view/use-year-view-url-sync";
import YearGrid from "@/components/year-view/year-grid";
import { useYearViewData } from "@/components/year-view/use-year-view-data";
import EventFormDialog from "@/components/year-view/event-form-dialog";
import DeleteEventDialog from "@/components/year-view/delete-event-dialog";
import { YearRefreshNotice } from "@/components/year-view/shared-components";
import type { YearViewInitialData } from "@/components/year-view/types";
import type {
  YearViewDataSource,
  YearViewEventApi,
  YearViewPreferences,
  YearViewRouterPort,
} from "@/components/year-view/year-view-ports";
import { getDefaultWritableCalendar, isWritableCalendar, type CalendarEvent } from "@/domain";
import { useI18n } from "@/i18n/context";

/**
 * The whole year view, minus any opinion about where its data and its focus
 * live. Both the authenticated app and the landing-page demo render this exact
 * component; they differ only in the ports they pass in.
 *
 * This component's job is composition: it owns the state reducer and wires the
 * ports to the hooks that do the actual work (loading, navigating, mutating,
 * scrolling). Anything with logic of its own belongs in one of those hooks.
 */
export default function YearViewCore({
  initialYear,
  initialData = null,
  router,
  dataSource,
  eventApi,
  preferences,
  banner,
}: {
  initialYear: number;
  initialData?: YearViewInitialData | null;
  router: YearViewRouterPort;
  dataSource: YearViewDataSource;
  eventApi: YearViewEventApi;
  preferences: YearViewPreferences;
  /** Strip rendered between the top bar and the grid. Used by the landing page. */
  banner?: ReactNode;
}) {
  const { formatDate } = useI18n();

  const [state, dispatch] = useReducer(yearViewReducer, undefined, () =>
    createInitialState({
      year: initialYear,
      calendars: initialData?.calendars,
      selectedCalendarIds: initialData?.selectedCalendarIds,
      events: initialData?.events,
    }),
  );
  const { calendars, error, events, isRefreshing, loading, selectedCalendarIds, year } = state;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const monthHeaderRefs = useRef<Array<HTMLDivElement | null>>([]);
  const rowsRef = useRef<HTMLDivElement | null>(null);
  const [jumpDayHighlight, setJumpDayHighlight] = useState<number | null>(null);
  const [focusTodaySignal, setFocusTodaySignal] = useState(0);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  // The grid owns its own focus; it hands us a callback so dialogs can return
  // focus to the cell the visitor came from after they close.
  const focusYearGridRef = useRef<(() => void) | null>(null);
  const registerFocusYearGrid = useCallback((focus: (() => void) | null) => {
    // eslint-disable-next-line functional/immutable-data
    focusYearGridRef.current = focus;
  }, []);
  const focusYearGrid = useCallback(() => {
    focusYearGridRef.current?.();
  }, []);

  const { urlFocus, navigateYearView, shouldApplyUrlFocus, markUrlFocusApplied } =
    useYearViewUrlSync(year, router);

  // The route is authoritative: a back/forward navigation changes `initialYear`
  // and the view follows.
  useEffect(() => {
    dispatch({ type: "YEAR_CHANGED", year: initialYear });
  }, [initialYear]);

  useEffect(() => {
    dispatch({
      type: "SIDEBAR_COLLAPSED_CHANGED",
      collapsed: preferences.getSidebarCollapsed(),
    });
  }, [preferences]);

  const { scrollToMonth } = useYearViewViewport({
    scrollRef,
    monthHeaderRefs,
    onScrollEdgesChange: useCallback(
      (edges: { left: boolean; right: boolean }) =>
        dispatch({ type: "SCROLL_EDGES_CHANGED", edges }),
      [],
    ),
    search: router.search,
    year,
    setJumpDayHighlight,
  });

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
    failures: state.failures,
    formatDate,
    isRefreshing,
    selectedCalendarIds,
    year,
  });

  const { loadData, updateSelectedCalendars, handleReloadCalendars } = useYearViewData({
    year,
    initialYear,
    initialData,
    source: dataSource,
    calendars,
    dispatch,
  });

  const reconcile = useCallback(() => {
    loadData(year);
  }, [loadData, year]);

  const mutations = useEventMutations({
    year,
    eventApi,
    targetCalendar: getDefaultWritableCalendar(calendars),
    dispatch,
    reconcile,
    focusYearGrid,
  });

  const onToggleSidebar = useCallback(() => {
    const collapsed = !state.sidebarCollapsed;
    dispatch({ type: "SIDEBAR_COLLAPSED_CHANGED", collapsed });
    preferences.setSidebarCollapsed(collapsed);
  }, [preferences, state.sidebarCollapsed]);

  const onOpenMobileSidebar = useCallback(() => {
    dispatch({ type: "MOBILE_SIDEBAR_OPEN_CHANGED", open: true });
  }, []);

  const onMobileSidebarOpenChange = useCallback((open: boolean) => {
    dispatch({ type: "MOBILE_SIDEBAR_OPEN_CHANGED", open });
  }, []);

  const navigation = useYearNavigation({
    year,
    initialYear,
    focusedCell: urlFocus?.cell,
    navigate: navigateYearView,
    scrollToMonth,
    dispatch,
    onJumpedToToday: useCallback(() => setFocusTodaySignal((value) => value + 1), []),
  });

  const onToggleCommandPalette = useCallback(() => setCommandPaletteOpen((open) => !open), []);

  useYearViewShortcuts({
    onToggleCommandPalette,
    onToggleSidebar,
    onRefresh: reconcile,
    onJumpToToday: navigation.onJumpToToday,
  });

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

  const canModifyEvent = useCallback(
    (event: CalendarEvent) =>
      isWritableCalendar(calendars.find((calendar) => calendar.id === event.calendarId)),
    [calendars],
  );

  const yearViewContextValue = useMemo(
    () => ({
      year,
      sidebarCollapsed: state.sidebarCollapsed,
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
      onRefresh: reconcile,
      onToggleSidebar,
      onOpenMobileSidebar,
      ...navigation,
    }),
    [
      calendars,
      commandPaletteOpen,
      focusYearGrid,
      isRefreshing,
      keyboardHelpOpen,
      monthNames,
      navigation,
      onOpenMobileSidebar,
      onToggleSidebar,
      reconcile,
      registerFocusYearGrid,
      selectedCalendarIds,
      state.sidebarCollapsed,
      syncBadge,
      todayLongLabel,
      year,
    ],
  );

  return (
    <TooltipProvider>
      <YearViewProvider value={yearViewContextValue}>
        <AppShell
          sidebarCollapsed={state.sidebarCollapsed}
          mobileSidebarOpen={state.mobileSidebarOpen}
          onMobileSidebarOpenChange={onMobileSidebarOpenChange}
          topbar={<YearViewTopBar />}
          banner={banner}
          sidebar={
            <YearViewSidebar
              error={error}
              onRetry={reconcile}
              loading={loading}
              onResync={handleReloadCalendars}
              onChangeCalendars={updateSelectedCalendars}
              visibleEventsCount={visibleEvents.length}
              unresolvedSelectedCalendarIds={unresolvedSelectedCalendarIds}
              onGoogleAuthChange={reconcile}
            />
          }
        >
          <main
            className="flex h-full w-full flex-1 min-h-0 flex-col"
            aria-label={`Calendar for ${year}`}
          >
            <div className="relative h-full">
              {isRefreshing && state.hasHydratedData && (
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
                scrollEdges={state.scrollEdges}
                rowsRef={rowsRef}
                rowHeight={ROW_HEIGHT}
                monthNames={monthNames}
                yearCalendarAriaLabel={`Calendar for ${year}`}
                todayLongLabel={todayLongLabel}
                jumpDayHighlight={jumpDayHighlight}
                focusTodaySignal={focusTodaySignal}
                keyboardHelpOpen={keyboardHelpOpen}
                commandPaletteOpen={commandPaletteOpen}
                mutationDialogOpen={mutations.anyDialogOpen}
                canModifyEvent={canModifyEvent}
                onRequestCreateEvent={mutations.create.open}
                onRequestEditEvent={mutations.edit.open}
                onRequestDeleteEvent={mutations.remove.open}
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
          open={mutations.create.isOpen}
          mode="create"
          dateLabel={
            mutations.create.target
              ? `${monthNames[mutations.create.target.month]} ${mutations.create.target.day}, ${year}`
              : ""
          }
          calendarName={getDefaultWritableCalendar(calendars)?.summary ?? null}
          submittable={getDefaultWritableCalendar(calendars) !== null}
          hint="Connect a writable Google calendar to create events."
          submitting={mutations.create.submitting}
          error={mutations.create.error}
          onSubmit={mutations.submitCreate}
          onOpenChange={mutations.create.setOpen}
        />
        <EventFormDialog
          open={mutations.edit.isOpen}
          mode="edit"
          initialTitle={mutations.edit.target?.title ?? ""}
          dateLabel={formatEventDateLabel(mutations.edit.target, monthNames)}
          calendarName={mutations.edit.target?.calendarSummary ?? null}
          submittable
          submitting={mutations.edit.submitting}
          error={mutations.edit.error}
          onSubmit={mutations.submitEdit}
          onOpenChange={mutations.edit.setOpen}
        />
        <DeleteEventDialog
          open={mutations.remove.isOpen}
          eventTitle={mutations.remove.target?.title ?? ""}
          deleting={mutations.remove.submitting}
          error={mutations.remove.error}
          onConfirm={mutations.confirmDelete}
          onOpenChange={mutations.remove.setOpen}
        />
      </YearViewProvider>
    </TooltipProvider>
  );
}

/** Friendly "Month D, YYYY" from an event's start, which may be date-only or ISO. */
function formatEventDateLabel(event: CalendarEvent | null, monthNames: string[]): string {
  if (!event) return "";
  const [year, month, day] = event.start.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "";
  return `${monthNames[month - 1]} ${day}, ${year}`;
}
