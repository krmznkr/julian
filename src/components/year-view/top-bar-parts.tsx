import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import AppLogo from "@/components/app-logo";
import ThemeToggle from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MAX_YEAR, MIN_YEAR } from "@/components/year-view/constants";
import { CommandPaletteTrigger } from "@/components/year-view/year-view-top-bar-panels";
import { SyncBadge } from "@/components/year-view/shared-components";

type SyncBadgeInfo = {
  kind: "issues" | "syncing" | "synced";
  label: string;
};

export function TopBarLogo({
  sidebarCollapsed,
  onToggleSidebar,
}: {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  return (
    <div className="flex h-10 items-center gap-2">
      <Button
        variant="ghost"
        size="icon-sm"
        className="hidden size-8 text-muted-foreground/70 hover:text-foreground md:inline-flex"
        aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-pressed={sidebarCollapsed}
        onClick={onToggleSidebar}
      >
        {sidebarCollapsed ? (
          <PanelLeftOpen className="size-4" aria-hidden="true" />
        ) : (
          <PanelLeftClose className="size-4" aria-hidden="true" />
        )}
      </Button>
      <AppLogo variant="minimal" />
    </div>
  );
}

export function YearNavigator({
  year,
  onYearChange,
  onYearKeyDown,
  onPreviousYear,
  onNextYear,
}: {
  year: number;
  onYearChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onYearKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onPreviousYear: () => void;
  onNextYear: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon-sm" aria-label="Previous year" onClick={onPreviousYear}>
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Button>

      <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-3.5 py-2">
        <Input
          type="number"
          value={year}
          min={MIN_YEAR}
          max={MAX_YEAR}
          onChange={onYearChange}
          onKeyDown={onYearKeyDown}
          className="h-7 w-20 border-0 bg-transparent px-0 text-center text-lg font-semibold tabular-nums focus-visible:ring-0"
          inputMode="numeric"
          name="year"
          aria-label="Year"
        />
      </div>

      <Button variant="ghost" size="icon-sm" aria-label="Next year" onClick={onNextYear}>
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </Button>
    </div>
  );
}

export function TopBarActions({
  onJumpToToday,
  todayLongLabel,
  syncBadge,
  monthNames,
  onMonthSelect,
  onOpenMobileSidebar,
}: {
  onJumpToToday: () => void;
  todayLongLabel: string;
  syncBadge: SyncBadgeInfo;
  monthNames: string[];
  onMonthSelect: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  onOpenMobileSidebar: () => void;
}) {
  return (
    <>
      <div className="hidden h-6 w-px bg-border/70 md:block" />

      <Button
        variant="outline"
        size="sm"
        className="hidden gap-2.5 px-3.5 md:inline-flex"
        aria-label={`Go to today, ${todayLongLabel}`}
        onClick={onJumpToToday}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        Today
      </Button>
      <div className="hidden md:block">
        <SyncBadge label={syncBadge.label} kind={syncBadge.kind} />
      </div>

      <select
        className="h-9 rounded-lg border border-border/60 bg-background px-2.5 text-xs md:hidden"
        aria-label="Jump to month"
        onChange={onMonthSelect}
        defaultValue=""
      >
        <option value="" disabled>
          Select all
        </option>
        {monthNames.map((label, index) => (
          <option key={label} value={index}>
            {label}
          </option>
        ))}
      </select>

      <Button variant="ghost" size="sm" className="md:hidden" onClick={onOpenMobileSidebar}>
        Calendars
      </Button>
    </>
  );
}

export function TopBarTrailing({
  syncBadge,
  commandPaletteOpen,
  onOpenCommandPalette,
  keyboardHelpOpen,
  onToggleKeyboardHelp,
}: {
  syncBadge: SyncBadgeInfo;
  commandPaletteOpen: boolean;
  onOpenCommandPalette: () => void;
  keyboardHelpOpen: boolean;
  onToggleKeyboardHelp: () => void;
}) {
  return (
    <div className="flex items-center justify-end gap-2 text-foreground/60">
      <div className="md:hidden">
        <SyncBadge label={syncBadge.label} kind={syncBadge.kind} />
      </div>
      <CommandPaletteTrigger open={commandPaletteOpen} onOpen={onOpenCommandPalette} />
      <button
        type="button"
        aria-pressed={keyboardHelpOpen}
        aria-label="Show keyboard shortcuts"
        onClick={onToggleKeyboardHelp}
        className="hidden size-8 items-center justify-center rounded-lg border border-border/60 bg-muted/30 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:inline-flex"
      >
        ?
      </button>
      <ThemeToggle />
    </div>
  );
}
