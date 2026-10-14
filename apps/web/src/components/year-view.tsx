// The authenticated year view: the shared core wired to the real router, the
// Google Calendar ports and the persisted sidebar preference.
import { useCallback, useMemo } from "react";
import YearViewCore from "@/components/year-view-core";
import type { YearViewInitialData } from "@/components/year-view/types";
import { makeGoogleDataSource, makeGoogleEventApi } from "@/components/year-view/google-ports";
import type {
  YearViewPreferences,
  YearViewRouterPort,
} from "@/components/year-view/year-view-ports";
import {
  getStoredSidebarCollapsedPreference,
  storeSidebarCollapsedPreference,
} from "@/lib/year-view-preferences";
import { provideApp } from "@/lib/effect/runtime";
import { useNavigate, useSearch } from "@/lib/router";

const googleDataSource = makeGoogleDataSource(provideApp);
const googleEventApi = makeGoogleEventApi(provideApp);

const storedPreferences: YearViewPreferences = {
  getSidebarCollapsed: getStoredSidebarCollapsedPreference,
  setSidebarCollapsed: storeSidebarCollapsedPreference,
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
