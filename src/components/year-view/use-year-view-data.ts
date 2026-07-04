import { useCallback, useEffect } from "react";
import type { YearViewInitialData } from "@/components/year-view/types";
import { loadGoogleYearData, isAuthenticated } from "@/lib/google-calendar";
import { saveSelectedCalendarIds } from "@/lib/calendar-selection";
import type { CalendarEvent, CalendarSummary } from "@/domain";

const EMPTY_YEAR_DATA: {
  calendars: CalendarSummary[];
  selectedCalendarIds: string[];
  events: CalendarEvent[];
} = { calendars: [], selectedCalendarIds: [], events: [] };

export function useYearViewData({
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
}: {
  year: number;
  initialYear: number;
  initialData: YearViewInitialData | null;
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

      try {
        const googleAuth = await isAuthenticated();

        // No dummy data: until Google Calendar is connected the view is empty
        // and the sidebar just offers the Connect button.
        const data = googleAuth
          ? await (async () => {
              try {
                return await loadGoogleYearData(targetYear);
              } catch (err) {
                console.error("Failed to load Google Calendar data:", err);
                setError(
                  err instanceof Error ? err.message : "Failed to load Google Calendar data.",
                );
                return EMPTY_YEAR_DATA;
              }
            })()
          : EMPTY_YEAR_DATA;

        setCalendars(data.calendars);
        setSelectedCalendarIds(data.selectedCalendarIds);
        setEvents(data.events);
        setHasHydratedData(true);
        setLoading(false);
      } catch (err) {
        console.error("Error loading data:", err);
        setError(err instanceof Error ? err.message : "Unknown error loading data");
        setLoading(false);
      }

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
    ],
  );

  useEffect(() => {
    if (initialData != null && year === initialYear) return;
    loadData(year);
  }, [year, initialYear, initialData, loadData]);

  const updateSelectedCalendars = useCallback(
    (nextSelection: string[]) => {
      saveSelectedCalendarIds(
        calendars.map((calendar) => calendar.id),
        nextSelection,
      );
      setSelectedCalendarIds(nextSelection);
    },
    [calendars, setSelectedCalendarIds],
  );

  const handleReloadCalendars = useCallback(() => {
    loadData(year);
  }, [loadData, year]);

  return { loadData, updateSelectedCalendars, handleReloadCalendars };
}
