import { useCallback, useEffect } from "react";
import type { YearViewInitialData } from "@/components/year-view/types";
import type { YearViewDataSource } from "@/components/year-view/year-view-ports";
import type { CalendarEvent, CalendarSummary } from "@/domain";

export function useYearViewData({
  year,
  initialYear,
  initialData,
  source,
  calendars,
  setEvents,
  setLoading,
  setIsRefreshing,
  setError,
  setHasHydratedData,
  setCalendars,
  setSelectedCalendarIds,
}: {
  year: number;
  initialYear: number;
  initialData: YearViewInitialData | null;
  source: YearViewDataSource;
  calendars: CalendarSummary[];
  setEvents: (events: CalendarEvent[] | ((prev: CalendarEvent[]) => CalendarEvent[])) => void;
  setLoading: (loading: boolean) => void;
  setIsRefreshing: (refreshing: boolean) => void;
  setError: (error: string | null) => void;
  setHasHydratedData: (hasHydrated: boolean) => void;
  setCalendars: (calendars: CalendarSummary[]) => void;
  setSelectedCalendarIds: (ids: string[]) => void;
}) {
  const loadData = useCallback(
    async (targetYear: number) => {
      setIsRefreshing(true);
      setError(null);

      // A failed first load still hydrates — with nothing — so the sidebar
      // shows the error plus the Connect button rather than an indefinite
      // spinner. A failed refresh or post-mutation reconcile keeps whatever is
      // already on screen: a dropped request should not blank the year or
      // discard the visitor's calendar selection.
      const data = await source.load(targetYear).catch((err: unknown) => {
        console.error("Failed to load year data:", err);
        setError(err instanceof Error ? err.message : "Failed to load calendar data.");
        return null;
      });

      if (data != null) {
        setCalendars([...data.calendars]);
        setSelectedCalendarIds([...data.selectedCalendarIds]);
        setEvents([...data.events]);
      }

      setHasHydratedData(true);
      setLoading(false);
      setIsRefreshing(false);
    },
    [
      setCalendars,
      setError,
      setEvents,
      setHasHydratedData,
      setIsRefreshing,
      setLoading,
      setSelectedCalendarIds,
      source,
    ],
  );

  useEffect(() => {
    if (initialData != null && year === initialYear) return;
    loadData(year);
  }, [year, initialYear, initialData, loadData]);

  const updateSelectedCalendars = useCallback(
    (nextSelection: string[]) => {
      source.persistSelection(
        calendars.map((calendar) => calendar.id),
        nextSelection,
      );
      setSelectedCalendarIds(nextSelection);
    },
    [calendars, setSelectedCalendarIds, source],
  );

  const handleReloadCalendars = useCallback(() => {
    loadData(year);
  }, [loadData, year]);

  return { loadData, updateSelectedCalendars, handleReloadCalendars };
}
