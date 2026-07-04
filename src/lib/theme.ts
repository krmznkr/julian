export type ThemeMode = "system" | "light" | "dark";

export function nextThemeMode(theme: string | undefined): ThemeMode {
  if (theme === "system" || theme === undefined) return "light";
  if (theme === "light") return "dark";
  return "system";
}
