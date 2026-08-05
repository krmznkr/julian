// The authenticated year view: the shared core wired to the real router, the
// Google Calendar API and the persisted calendar-selection preference.
import { useCallback, useMemo } from "react";
import YearViewCore from "@/components/year-view-core";
import type { YearViewInitialData } from "@/components/year-view/types";
import type {
  YearViewDataSource,
  YearViewEventApi,
  YearViewPreferences,
  YearViewRouterPort,
} from "@/components/year-view/year-view-ports";
import { saveSelectedCalendarIdsSync } from "@/lib/calendar-selection";
import {
  getStoredSidebarCollapsedPreference,
  storeSidebarCollapsedPreference,
} from "@/lib/year-view-preferences";
import {
  createEvent,
  deleteEvent,
  isAuthenticated,
  loadGoogleYearData,
  updateEvent,
} from "@/lib/google-calendar";
import { useNavigate, useSearch } from "@/lib/router";

const EMPTY_YEAR = { calendars: [], selectedCalendarIds: [], events: [] } as const;

const googleEventApi: YearViewEventApi = { createEvent, updateEvent, deleteEvent };

const storedPreferences: YearViewPreferences = {
  getSidebarCollapsed: getStoredSidebarCollapsedPreference,
  setSidebarCollapsed: storeSidebarCollapsedPreference,
};

const googleDataSource: YearViewDataSource = {
  // No dummy data: until Google Calendar is connected the view is empty and the
  // sidebar just offers the Connect button.
  load: async (year) => ((await isAuthenticated()) ? loadGoogleYearData(year) : EMPTY_YEAR),
  persistSelection: saveSelectedCalendarIdsSync,
};

export default function YearView({
  initialYear,
  initialData = null,
}: {
  initialYear: number;
  initialData?: YearViewInitialData | null;
}) {
  const search = useSearch({ from: "/year/$year" });
  const navigate = useNavigate();

  const navigateToFocus = useCallback<YearViewRouterPort["navigate"]>(
    (target) => {
      navigate({
        to: "/year/$year",
        params: { year: String(target.year) },
        search: target.search,
        replace: target.replace,
      });
    },
    [navigate],
  );

  const router = useMemo<YearViewRouterPort>(
    () => ({ search, navigate: navigateToFocus }),
    [navigateToFocus, search],
  );

  return (
    <YearViewCore
      initialYear={initialYear}
      initialData={initialData}
      router={router}
      dataSource={googleDataSource}
      eventApi={googleEventApi}
      preferences={storedPreferences}
    />
  );
}
