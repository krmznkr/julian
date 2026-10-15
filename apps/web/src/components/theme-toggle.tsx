import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { nextThemeMode } from "@/lib/theme";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme, theme } = useTheme();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isDark = resolvedTheme === "dark";
  const isSystem = theme === "system";

  const label = isSystem
    ? "Switch to light theme"
    : isDark
      ? "Switch to system theme"
      : "Switch to dark theme";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      type="button"
      aria-label={label}
      onClick={() => setTheme(nextThemeMode(theme))}
      className="border border-transparent text-foreground/90 hover:border-border/70"
      disabled={!mounted}
    >
      {isSystem ? (
        <Laptop aria-hidden="true" />
      ) : isDark ? (
        <Sun aria-hidden="true" />
      ) : (
        <Moon aria-hidden="true" />
      )}
    </Button>
  );
}
