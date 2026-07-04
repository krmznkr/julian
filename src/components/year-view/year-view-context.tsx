import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
} from "react";
import type { CalendarSummary } from "@/domain";

type YearViewSharedDataContextValue = {
  calendars: CalendarSummary[];
  monthNames: string[];
};

const YearViewSharedDataContext = createContext<YearViewSharedDataContextValue | null>(null);

export function YearViewSharedDataProvider({
  value,
  children,
}: {
  value: YearViewSharedDataContextValue;
  children: ReactNode;
}) {
  return (
    <YearViewSharedDataContext.Provider value={value}>
      {children}
    </YearViewSharedDataContext.Provider>
  );
}

export function useYearViewSharedData() {
  const context = useContext(YearViewSharedDataContext);
  if (!context) {
    throw new Error("useYearViewSharedData must be used within YearViewSharedDataProvider");
  }
  return context;
}

// ---------------------------------------------------------------------------
// Top-level YearView context (consumed by TopBar, Sidebar, and main area)
// ---------------------------------------------------------------------------

type SyncBadgeInfo = {
  kind: "issues" | "syncing" | "synced";
  label: string;
};

type YearViewContextValue = {
  year: number;
  sidebarCollapsed: boolean;
  syncBadge: SyncBadgeInfo;
  isRefreshing: boolean;
  monthNames: string[];
  todayLongLabel: string;
  calendars: CalendarSummary[];
  selectedCalendarIds: string[];
  keyboardHelpOpen: boolean;
  setKeyboardHelpOpen: Dispatch<SetStateAction<boolean>>;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: Dispatch<SetStateAction<boolean>>;
  registerFocusYearGrid: (focus: (() => void) | null) => void;
  focusYearGrid: () => void;
  onYearChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onYearKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onPreviousYear: () => void;
  onNextYear: () => void;
  onJumpToToday: () => void;
  onRefresh: () => void;
  onToggleSidebar: () => void;
  onOpenMobileSidebar: () => void;
  onMonthSelect: (event: React.ChangeEvent<HTMLSelectElement>) => void;
};

const YearViewContext = createContext<YearViewContextValue | null>(null);

export function YearViewProvider({
  value,
  children,
}: {
  value: YearViewContextValue;
  children: ReactNode;
}) {
  return <YearViewContext.Provider value={value}>{children}</YearViewContext.Provider>;
}

export function useYearViewContext() {
  const context = useContext(YearViewContext);
  if (!context) {
    throw new Error("useYearViewContext must be used within YearViewProvider");
  }
  return context;
}
