import {
  SyncStatusBadge,
  SidebarError,
  SidebarCalendarSection,
  SidebarFooter,
} from "@/components/year-view/sidebar-parts";
import { useYearViewContext } from "@/components/year-view/year-view-context";

export default function YearViewSidebar({
  error,
  onRetry,
  loading,
  onResync,
  onChangeCalendars,
  visibleEventsCount,
  unresolvedSelectedCalendarIds,
  onGoogleAuthChange,
}: {
  error: string | null;
  onRetry: () => void;
  loading: boolean;
  onResync: () => void;
  onChangeCalendars: (nextSelection: ReadonlyArray<string>) => void;
  visibleEventsCount: number;
  unresolvedSelectedCalendarIds: string[];
  onGoogleAuthChange?: () => void;
}) {
  const { syncBadge, calendars, selectedCalendarIds, isRefreshing, year } = useYearViewContext();

  return (
    <div className="flex flex-col h-full">
      <SyncStatusBadge syncBadge={syncBadge} />
      <SidebarError error={error} onRetry={onRetry} />
      <SidebarCalendarSection
        calendars={calendars}
        selectedCalendarIds={selectedCalendarIds}
        loading={loading}
        isRefreshing={isRefreshing}
        onResync={onResync}
        onChangeCalendars={onChangeCalendars}
        visibleEventsCount={visibleEventsCount}
        unresolvedSelectedCalendarIds={unresolvedSelectedCalendarIds}
        onGoogleAuthChange={onGoogleAuthChange}
      />
      <SidebarFooter visibleEventsCount={visibleEventsCount} year={year} />
    </div>
  );
}
