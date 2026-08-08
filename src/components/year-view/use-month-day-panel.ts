import { useEffect, useMemo, useState, type RefObject } from "react";
import type { DayEventItem } from "@/components/year-view/use-month-column";

export type DayPanelAnchorRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** Shared so a day with no events keeps the same array identity across renders. */
const NO_ITEMS: DayEventItem[] = [];

/** Positions the keyboard-driven day detail panel — no pointer/hover behavior. */
export function useMonthDayPanel(
  dayEvents: Map<number, DayEventItem[]>,
  monthName: string,
  openDay: number | null,
  layerRef: RefObject<HTMLDivElement | null>,
  rowHeight: number,
) {
  const [anchorRect, setAnchorRect] = useState<DayPanelAnchorRect | null>(null);

  const open = openDay !== null;
  const items = (openDay !== null ? dayEvents.get(openDay) : undefined) ?? NO_ITEMS;
  const label = openDay !== null ? `${monthName} ${openDay}` : "";

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer || openDay === null) {
      setAnchorRect(null);
      return;
    }

    const rect = layer.getBoundingClientRect();
    setAnchorRect({
      left: rect.left,
      top: rect.top + (openDay - 1) * rowHeight,
      width: rect.width,
      height: rowHeight,
    });
  }, [layerRef, openDay, rowHeight]);

  return useMemo(
    () => ({
      open,
      items,
      label,
      anchorRect,
      anchorEl: layerRef.current,
    }),
    [anchorRect, items, label, layerRef, open],
  );
}
