// The day-cell layer (single-day events) and the multi-day bar layer are two
// stacked grids sharing one column template so their columns line up. When a
// month has both multi-day bars and single-day events we append one extra
// "single-day strip" column on the right: bars keep lanes 1..multiDayLanes and
// single-day events move into the strip, so the two never sit on top of each
// other and instead divide the column width between them.

export function monthColumnTemplateColumns(multiDayLanes: number, hasSingleStrip: boolean): string {
  const total = Math.max(1, multiDayLanes) + (hasSingleStrip ? 1 : 0);
  return `repeat(${total}, minmax(0, 1fr))`;
}

/** Whether the single-day strip column should be reserved for this month. */
export function hasSingleDayStrip(multiDayLanes: number, hasSingleDay: boolean): boolean {
  return hasSingleDay && multiDayLanes >= 1;
}
