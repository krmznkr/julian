import { useCallback, useEffect, useRef } from "react";
import type { YearViewAction } from "@/components/year-view-reducer";
import type { YearViewInitialData } from "@/components/year-view/types";
import type { YearViewDataSource } from "@/components/year-view/year-view-ports";
import type { CalendarSummary } from "@/domain";

export function useYearViewData({
  year,
  initialYear,
  initialData,
  source,
  calendars,
  dispatch,
}: {
  year: number;
  initialYear: number;
  initialData: YearViewInitialData | null;
  source: YearViewDataSource;
  calendars: ReadonlyArray<CalendarSummary>;
  dispatch: (action: YearViewAction) => void;
}) {
  const requestId = useRef(0);
  const selection = useRef<ReadonlyArray<string> | null>(null);
  const firstLoad = useRef(true);
  const loadData = useCallback(
    async (targetYear: number) => {
      const id = ++requestId.current;
      const selectionAtStart = selection.current;
      dispatch({ type: "LOAD_STARTED" });

      try {
        const data = await source.load(targetYear);
        if (id !== requestId.current) return;
        dispatch({
          type: "LOAD_SUCCEEDED",
          calendars: data.calendars,
          selectedCalendarIds:
            selection.current !== selectionAtStart && selection.current !== null
              ? selection.current
              : data.selectedCalendarIds,
          events: data.events,
          failures: data.failures,
        });
      } catch (err) {
        if (id !== requestId.current) return;
        console.error("Failed to load year data:", err);
        dispatch({
          type: "LOAD_FAILED",
          message: err instanceof Error ? err.message : "Failed to load calendar data.",
        });
      }
    },
    [dispatch, source],
  );

  useEffect(() => {
    if (!firstLoad.current || initialData == null || year !== initialYear) loadData(year);
    firstLoad.current = false;
    return () => {
      requestId.current += 1;
    };
  }, [year, initialYear, initialData, loadData]);

  const updateSelectedCalendars = useCallback(
    (nextSelection: ReadonlyArray<string>) => {
      selection.current = nextSelection;
      source.persistSelection(
        calendars.map((calendar) => calendar.id),
        nextSelection,
      );
      dispatch({ type: "CALENDAR_SELECTION_CHANGED", selectedCalendarIds: nextSelection });
    },
    [calendars, dispatch, source],
  );

  const handleReloadCalendars = useCallback(() => {
    loadData(year);
  }, [loadData, year]);

  return { loadData, updateSelectedCalendars, handleReloadCalendars };
}
