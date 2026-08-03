import {
  SidebarHeader,
  SyncStatusBadge,
  SidebarError,
  SidebarCalendarSection,
  SidebarFooter,
} from "@/components/year-view/sidebar-parts";
import { useYearViewContext } from "@/components/year-view/year-view-context";

export default function YearViewSidebar({
  error,
  onRetry,
  calendarLoading,
  loading,
  onResync,
  onChangeCalendars,
  visibleEventsCount,
  unresolvedSelectedCalendarIds,
  onGoogleAuthChange,
}: {
  error: string | null;
  onRetry: () => void;
  calendarLoading: boolean;
  loading: boolean;
  onResync: () => void;
  onChangeCalendars: (nextSelection: string[]) => void;
  visibleEventsCount: number;
  unresolvedSelectedCalendarIds: string[];
  onGoogleAuthChange?: () => void;
}) {
  const {
    sidebarCollapsed,
    onToggleSidebar,
    syncBadge,
    calendars,
    selectedCalendarIds,
    isRefreshing,
    year,
  } = useYearViewContext();

  return (
    <div className="flex flex-col h-full">
      <SidebarHeader sidebarCollapsed={sidebarCollapsed} onToggleSidebar={onToggleSidebar} />
      <SyncStatusBadge syncBadge={syncBadge} />
      <SidebarError error={error} onRetry={onRetry} />
      <SidebarCalendarSection
        calendars={calendars}
        selectedCalendarIds={selectedCalendarIds}
        calendarLoading={calendarLoading}
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
