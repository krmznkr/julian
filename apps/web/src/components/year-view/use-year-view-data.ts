import { useCallback, useEffect, useRef } from "react";
import { Effect } from "effect";
import type { YearViewAction } from "@/components/year-view-reducer";
import type { YearViewInitialData } from "@/components/year-view/types";
import type { YearViewDataSource } from "@/components/year-view/year-view-ports";
import { useLatestFiber } from "@/lib/effect/use-latest-fiber";
import type { CalendarSummary } from "@julian/domain";

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
  const selection = useRef<ReadonlyArray<string> | null>(null);
  const firstLoad = useRef(true);
  const { run, interrupt } = useLatestFiber();

  // Each load supersedes the previous one: its fiber is interrupted, so a
  // slower, older year can never overwrite the one on screen.
  const loadData = useCallback(
    (targetYear: number) => {
      const selectionAtStart = selection.current;
      dispatch({ type: "LOAD_STARTED" });
      run(
        source.load(targetYear).pipe(
          Effect.match({
            onSuccess: (data) =>
              dispatch({
                type: "LOAD_SUCCEEDED",
                calendars: data.calendars,
                selectedCalendarIds:
                  selection.current !== selectionAtStart && selection.current !== null
                    ? selection.current
                    : data.selectedCalendarIds,
                events: data.events,
                failures: data.failures,
              }),
            onFailure: (error) => {
              console.error("Failed to load year data:", error);
              dispatch({ type: "LOAD_FAILED", message: error.message });
            },
          }),
        ),
      );
    },
    [dispatch, run, source],
  );

  useEffect(() => {
    if (!firstLoad.current || initialData == null || year !== initialYear) loadData(year);
    firstLoad.current = false;
    return interrupt;
  }, [year, initialYear, initialData, loadData, interrupt]);

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
