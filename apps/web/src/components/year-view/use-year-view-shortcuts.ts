import { useEffect } from "react";
import { useTheme } from "next-themes";
import { isTypingTarget } from "@/components/year-view/year-grid-keyboard";
import { nextThemeMode } from "@/lib/theme";

/**
 * Shortcuts that work anywhere in the year view, as opposed to the grid-local
 * keys in `use-year-grid-keyboard`. Kept apart because these stay bound while a
 * dialog or the sidebar has focus, and because they must not fight the grid's
 * own handling — hence the `defaultPrevented` bail-out.
 */
export function useYearViewShortcuts({
  onToggleCommandPalette,
  onToggleSidebar,
  onRefresh,
  onJumpToToday,
}: {
  onToggleCommandPalette: () => void;
  onToggleSidebar: () => void;
  onRefresh: () => void;
  onJumpToToday: () => void;
}) {
  const { setTheme, theme } = useTheme();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (isTypingTarget(event.target)) return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onToggleCommandPalette();
        return;
      }

      // Everything below is an unmodified letter, so a browser or OS chord
      // (Cmd+R, Alt+T) keeps its normal meaning.
      if (event.altKey || event.ctrlKey || event.metaKey) return;

      switch (event.key.toLowerCase()) {
        case "s":
          event.preventDefault();
          onToggleSidebar();
          return;
        case "r":
          event.preventDefault();
          onRefresh();
          return;
        case "t":
          event.preventDefault();
          if (event.shiftKey) setTheme(nextThemeMode(theme));
          else onJumpToToday();
          return;
        default:
          return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onJumpToToday, onRefresh, onToggleCommandPalette, onToggleSidebar, setTheme, theme]);
}
