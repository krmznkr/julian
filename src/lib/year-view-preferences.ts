const SIDEBAR_COLLAPSED_STORAGE_KEY = "julian.yearView.sidebarCollapsed";

function isBooleanString(value: string | null): value is "true" | "false" {
  return value === "true" || value === "false";
}

export function getStoredSidebarCollapsedPreference(): boolean {
  if (typeof window === "undefined") return false;
  const value = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
  if (!isBooleanString(value)) return false;
  return value === "true";
}

export function storeSidebarCollapsedPreference(collapsed: boolean) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, collapsed ? "true" : "false");
}
