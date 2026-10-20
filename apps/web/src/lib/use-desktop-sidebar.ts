import { useState, useSyncExternalStore } from "react";

// Tailwind's md breakpoint. Read synchronously so the first client render
// mounts only the visible sidebar, including on a cold desktop visit.
export function useDesktopSidebar(): boolean {
  const [query] = useState(() => window.matchMedia("(min-width: 48rem)"));
  const [store] = useState(() => ({
    subscribe: (onChange: () => void) => {
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    getSnapshot: () => query.matches,
  }));
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
