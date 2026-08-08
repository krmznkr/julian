import { useCallback, useEffect } from "react";
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
  const loadData = useCallback(
    async (targetYear: number) => {
      dispatch({ type: "LOAD_STARTED" });

      try {
        const data = await source.load(targetYear);
        dispatch({
          type: "LOAD_SUCCEEDED",
          calendars: data.calendars,
          selectedCalendarIds: data.selectedCalendarIds,
          events: data.events,
          failures: data.failures,
        });
      } catch (err) {
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
    if (initialData != null && year === initialYear) return;
    loadData(year);
  }, [year, initialYear, initialData, loadData]);

  const updateSelectedCalendars = useCallback(
    (nextSelection: ReadonlyArray<string>) => {
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
