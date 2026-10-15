// The authenticated year view: the shared core wired to the real router, the
// Google Calendar ports and the persisted sidebar preference.
import YearViewCore from "@/components/year-view-core";
import type { YearViewInitialData } from "@/components/year-view/types";
import { makeGoogleDataSource, makeGoogleEventApi } from "@/components/year-view/google-ports";
import { useRoutePort } from "@/components/year-view/use-route-port";
import type { YearViewPreferences } from "@/components/year-view/year-view-ports";
import {
  getStoredSidebarCollapsedPreference,
  storeSidebarCollapsedPreference,
} from "@/lib/year-view-preferences";
import { provideApp } from "@/lib/effect/runtime";

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
  const router = useRoutePort("/$year");

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
