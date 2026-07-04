import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import { isAuthenticated, logout, startGoogleAuth } from "@/lib/google-calendar";
import {
  TopBarLogo,
  YearNavigator,
  TopBarActions,
  TopBarTrailing,
} from "@/components/year-view/top-bar-parts";
import { useYearViewContext } from "@/components/year-view/year-view-context";
import {
  TopBarKeyboardShortcuts,
  YearViewCommandPalette,
} from "@/components/year-view/year-view-top-bar-panels";
import { nextThemeMode } from "@/lib/theme";

export default function YearViewTopBar() {
  const {
    sidebarCollapsed,
    onToggleSidebar,
    year,
    onYearChange,
    onYearKeyDown,
    onPreviousYear,
    onNextYear,
    onJumpToToday,
    onRefresh,
    todayLongLabel,
    syncBadge,
    monthNames,
    onMonthSelect,
    onOpenMobileSidebar,
    keyboardHelpOpen,
    setKeyboardHelpOpen,
    commandPaletteOpen,
    setCommandPaletteOpen,
    focusYearGrid,
  } = useYearViewContext();
  const { setTheme, theme } = useTheme();

  const [isConnected, setIsConnected] = useState(false);

  // Re-check connection whenever the palette opens so the command label
  // (Connect vs Disconnect) reflects the current auth state.
  useEffect(() => {
    if (!commandPaletteOpen) return;
    isAuthenticated().then(setIsConnected);
  }, [commandPaletteOpen]);

  const handleConnect = useCallback(async () => {
    try {
      // In the browser this redirects away and never returns; in the desktop
      // app it resolves once the loopback OAuth exchange completes.
      await startGoogleAuth();
      const authed = await isAuthenticated();
      setIsConnected(authed);
      if (authed) onRefresh();
    } catch (err) {
      console.error("Failed to connect Google Calendar:", err);
    }
  }, [onRefresh]);

  const handleDisconnect = useCallback(() => {
    logout();
    setIsConnected(false);
    onRefresh();
  }, [onRefresh]);

  const commandItems = useMemo(
    () => [
      {
        id: "today",
        label: "Jump to today",
        hint: "T",
        onSelect: onJumpToToday,
      },
      {
        id: "refresh",
        label: "Refresh events",
        hint: "R",
        onSelect: onRefresh,
      },
      {
        id: "shortcuts",
        label: "Show keyboard shortcuts",
        hint: "?",
        onSelect: () => setKeyboardHelpOpen(true),
      },
      {
        id: "theme",
        label: "Toggle theme",
        hint: "Shift T",
        onSelect: () => setTheme(nextThemeMode(theme)),
      },
      {
        id: "sidebar",
        label: "Toggle sidebar",
        hint: "S",
        onSelect: onToggleSidebar,
      },
      {
        id: "prev-year",
        label: "Previous year",
        hint: undefined,
        onSelect: onPreviousYear,
      },
      {
        id: "next-year",
        label: "Next year",
        hint: undefined,
        onSelect: onNextYear,
      },
      isConnected
        ? {
            id: "disconnect",
            label: "Disconnect Google Calendar",
            hint: undefined,
            onSelect: handleDisconnect,
          }
        : {
            id: "connect",
            label: "Connect Google Calendar",
            hint: undefined,
            onSelect: handleConnect,
          },
    ],
    [
      handleConnect,
      handleDisconnect,
      isConnected,
      onJumpToToday,
      onNextYear,
      onPreviousYear,
      onRefresh,
      onToggleSidebar,
      setKeyboardHelpOpen,
      setTheme,
      theme,
    ],
  );

  const handleCommandOpenChange = (open: boolean) => {
    setCommandPaletteOpen(open);
    if (!open) focusYearGrid();
  };

  const handleHelpOpenChange = (open: boolean) => {
    setKeyboardHelpOpen(open);
    if (!open) focusYearGrid();
  };

  return (
    <header
      className="sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ paddingTop: "var(--titlebar-height)" }}
    >
      <div className="grid h-16 w-full grid-cols-[minmax(200px,260px)_1fr_minmax(240px,320px)] items-center gap-4 px-7">
        <TopBarLogo sidebarCollapsed={sidebarCollapsed} onToggleSidebar={onToggleSidebar} />

        <div className="flex items-center justify-center gap-2">
          <YearNavigator
            year={year}
            onYearChange={onYearChange}
            onYearKeyDown={onYearKeyDown}
            onPreviousYear={onPreviousYear}
            onNextYear={onNextYear}
          />
          <TopBarActions
            onJumpToToday={onJumpToToday}
            todayLongLabel={todayLongLabel}
            syncBadge={syncBadge}
            monthNames={monthNames}
            onMonthSelect={onMonthSelect}
            onOpenMobileSidebar={onOpenMobileSidebar}
          />
        </div>

        <TopBarTrailing
          syncBadge={syncBadge}
          commandPaletteOpen={commandPaletteOpen}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
          keyboardHelpOpen={keyboardHelpOpen}
          onToggleKeyboardHelp={() => setKeyboardHelpOpen((open) => !open)}
        />
      </div>

      <YearViewCommandPalette
        open={commandPaletteOpen}
        onOpenChange={handleCommandOpenChange}
        commands={commandItems}
      />
      <TopBarKeyboardShortcuts open={keyboardHelpOpen} onOpenChange={handleHelpOpenChange} />
    </header>
  );
}
