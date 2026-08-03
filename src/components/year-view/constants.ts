export const DAYS_IN_GRID = 31;

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Faint vertical guides on the day timeline (24h axis). */
export const DAY_TIMELINE_MARK_HOURS = [8, 12, 18, 21] as const;

export function hourToDayPct(hour: number): number {
  return (hour / 24) * 100;
}

export const MIN_YEAR = 1970;
export const MAX_YEAR = 2100;
