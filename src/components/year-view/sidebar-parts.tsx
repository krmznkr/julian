import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CalendarList, CalendarListSkeleton } from "@/components/year-view/calendar-list";
import { GoogleLoginButton } from "@/components/google-login-button";
import type { CalendarSummary } from "@/domain";
import { cn } from "@/lib/utils";

export function SidebarHeader({
  sidebarCollapsed: _sidebarCollapsed,
  onToggleSidebar: _onToggleSidebar,
}: {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  return null;
}

export function SyncStatusBadge({
  syncBadge,
}: {
  syncBadge: { kind: "issues" | "syncing" | "synced"; label: string };
}) {
  if (syncBadge.kind !== "issues") return null;

  return (
    <div className="mb-4 p-3 rounded-lg border border-border/60 bg-muted/30">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "size-2 rounded-full",
            syncBadge.kind === "issues" ? "bg-destructive" : "bg-amber-500 animate-pulse",
          )}
        />
        <span className="text-sm font-medium">{syncBadge.label}</span>
      </div>
    </div>
  );
}

export function SidebarError({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  if (!error) return null;

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
      <div className="flex items-start gap-2">
        <svg
          viewBox="0 0 24 24"
          className="size-4 mt-0.5 flex-shrink-0 text-destructive"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <p className="text-xs text-destructive flex-1">{error}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 border-destructive/30 text-destructive hover:bg-destructive/10 text-xs"
          onClick={onRetry}
        >
          Retry
        </Button>
      </div>
    </div>
  );
}

export function SidebarCalendarSection({
  calendars,
  selectedCalendarIds,
  calendarLoading,
  loading,
  isRefreshing,
  onResync,
  onChangeCalendars,
  visibleEventsCount,
  unresolvedSelectedCalendarIds,
  onGoogleAuthChange,
}: {
  calendars: CalendarSummary[];
  selectedCalendarIds: string[];
  calendarLoading: boolean;
  loading: boolean;
  isRefreshing: boolean;
  onResync: () => void;
  onChangeCalendars: (nextSelection: string[]) => void;
  visibleEventsCount: number;
  unresolvedSelectedCalendarIds: string[];
  onGoogleAuthChange?: () => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="space-y-4">
        <GoogleLoginButton onAuthChange={onGoogleAuthChange} />

        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Calendars
          </h2>
          <div className="flex items-center gap-2">
            {calendars.length > 0 && (
              <span className="text-xs text-muted-foreground/60">
                {selectedCalendarIds.length}/{calendars.length}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 text-muted-foreground/80"
              aria-label="Reload calendars"
              disabled={calendarLoading || loading || isRefreshing}
              onClick={onResync}
            >
              <RefreshCw
                className={cn("size-3.5", (calendarLoading || isRefreshing) && "animate-spin")}
                aria-hidden="true"
              />
            </Button>
          </div>
        </div>

        {loading && calendars.length === 0 ? (
          <div className="space-y-3">
            <CalendarListSkeleton />
            <div className="flex items-center gap-2 px-1">
              <div className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
              <p className="text-xs text-muted-foreground/70">Loading calendars...</p>
            </div>
          </div>
        ) : (
          <>
            <CalendarList
              calendars={calendars}
              selectedCalendarIds={selectedCalendarIds}
              onChange={onChangeCalendars}
              disabled={calendarLoading}
            />

            <div className="space-y-2 px-1">
              {calendars.length === 0 && selectedCalendarIds.length === 0 && !loading && (
                <div className="space-y-2 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground/80">
                  <p>Connect Google Calendar to see your calendars and events.</p>
                </div>
              )}

              {visibleEventsCount === 0 && selectedCalendarIds.length > 0 && !loading && (
                <div className="flex items-start gap-2 rounded-md bg-muted/30 p-2">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-3.5 mt-0.5 flex-shrink-0 text-muted-foreground/60"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                  <p className="text-xs text-muted-foreground/70 flex-1">No events found</p>
                </div>
              )}

              {unresolvedSelectedCalendarIds.length > 0 && (
                <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2">
                  <p className="text-xs text-amber-900 dark:text-amber-200">
                    Some selected calendars are unavailable. Reload local data to restore them.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-full border-amber-500/50 text-xs text-amber-900 hover:bg-amber-500/20 dark:text-amber-200"
                    disabled={calendarLoading || loading || isRefreshing}
                    onClick={onResync}
                  >
                    <RefreshCw
                      className={cn(
                        "mr-1.5 size-3.5",
                        (calendarLoading || isRefreshing) && "animate-spin",
                      )}
                      aria-hidden="true"
                    />
                    Reload calendars
                  </Button>
                </div>
              )}

              {calendarLoading && (
                <div className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
                  <p className="text-xs text-muted-foreground/70">Loading calendars...</p>
                </div>
              )}

              {isRefreshing && (
                <div className="flex items-center gap-2">
                  <div className="size-1.5 rounded-full bg-muted-foreground/40 animate-pulse" />
                  <p className="text-xs text-muted-foreground/70">Loading events...</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function SidebarFooter({
  visibleEventsCount,
  year,
}: {
  visibleEventsCount: number;
  year: number;
}) {
  if (visibleEventsCount <= 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-border/40">
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground/60">
        <span>
          {visibleEventsCount} {visibleEventsCount === 1 ? "event" : "events"}
        </span>
        <span>{year}</span>
      </div>
    </div>
  );
}
