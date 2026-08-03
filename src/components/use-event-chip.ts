import { useMemo } from "react";
import { addDays, parseEventBoundary } from "@/domain";
import type { CalendarEvent, EventSegment } from "@/domain";
import { cn } from "@/lib/utils";

const MAX_CHIP_DISPLAY_LANE = 16;
const CHIP_ROW_START_CLASSES = [
  "",
  "row-start-1",
  "row-start-2",
  "row-start-3",
  "row-start-4",
  "row-start-5",
  "row-start-6",
  "row-start-7",
  "row-start-8",
  "row-start-9",
  "row-start-10",
  "row-start-11",
  "row-start-12",
  "row-start-13",
  "row-start-14",
  "row-start-15",
  "row-start-16",
  "row-start-17",
  "row-start-18",
  "row-start-19",
  "row-start-20",
  "row-start-21",
  "row-start-22",
  "row-start-23",
  "row-start-24",
  "row-start-25",
  "row-start-26",
  "row-start-27",
  "row-start-28",
  "row-start-29",
  "row-start-30",
  "row-start-31",
] as const;
const CHIP_ROW_END_CLASSES = [
  "",
  "row-end-1",
  "row-end-2",
  "row-end-3",
  "row-end-4",
  "row-end-5",
  "row-end-6",
  "row-end-7",
  "row-end-8",
  "row-end-9",
  "row-end-10",
  "row-end-11",
  "row-end-12",
  "row-end-13",
  "row-end-14",
  "row-end-15",
  "row-end-16",
  "row-end-17",
  "row-end-18",
  "row-end-19",
  "row-end-20",
  "row-end-21",
  "row-end-22",
  "row-end-23",
  "row-end-24",
  "row-end-25",
  "row-end-26",
  "row-end-27",
  "row-end-28",
  "row-end-29",
  "row-end-30",
  "row-end-31",
  "row-end-32",
] as const;
const CHIP_COL_START_CLASSES = [
  "",
  "col-start-1",
  "col-start-2",
  "col-start-3",
  "col-start-4",
  "col-start-5",
  "col-start-6",
  "col-start-7",
  "col-start-8",
  "col-start-9",
  "col-start-10",
  "col-start-11",
  "col-start-12",
  "col-start-13",
  "col-start-14",
  "col-start-15",
  "col-start-16",
] as const;
const CHIP_COL_END_CLASSES = [
  "",
  "col-end-1",
  "col-end-2",
  "col-end-3",
  "col-end-4",
  "col-end-5",
  "col-end-6",
  "col-end-7",
  "col-end-8",
  "col-end-9",
  "col-end-10",
  "col-end-11",
  "col-end-12",
  "col-end-13",
  "col-end-14",
  "col-end-15",
  "col-end-16",
  "col-end-17",
] as const;

function getChipPlacementClass(
  displayStartDay: number,
  displayEndDay: number,
  resolvedLane: number,
  fullWidth: boolean | undefined,
) {
  const rowStart = CHIP_ROW_START_CLASSES[displayStartDay];
  const rowEnd = CHIP_ROW_END_CLASSES[displayEndDay + 1];

  if (!rowStart || !rowEnd) {
    return null;
  }

  if (fullWidth) {
    return cn(rowStart, rowEnd, "col-start-1", "col-end-[-1]");
  }

  if (resolvedLane > MAX_CHIP_DISPLAY_LANE) {
    return null;
  }

  const colStart = CHIP_COL_START_CLASSES[resolvedLane];
  const colEnd = CHIP_COL_END_CLASSES[resolvedLane + 1];
  if (!colStart || !colEnd) {
    return null;
  }

  return cn(rowStart, rowEnd, colStart, colEnd);
}

export function useChipStyle(
  segment: EventSegment,
  overrideStartDay: number | undefined,
  overrideEndDay: number | undefined,
  displayLane: number | undefined,
  fullWidth: boolean | undefined,
  variant: "chip" | "square",
  leftZoneEndColumn?: number,
) {
  const displayStartDay = overrideStartDay ?? segment.startDay;
  const displayEndDay = overrideEndDay ?? segment.endDay;
  const accentColor = segment.calendarColor ?? "#6b7280";
  const resolvedLane = displayLane ?? segment.lane;
  // Chips (multi-day bars) are grid items placed by row/column. Squares live
  // inside a per-day flex strip, so they take no grid placement.
  const isChip = variant === "chip";

  const placementClassName = useMemo(
    () =>
      isChip
        ? getChipPlacementClass(displayStartDay, displayEndDay, resolvedLane, fullWidth)
        : null,
    [displayEndDay, displayStartDay, fullWidth, isChip, resolvedLane],
  );

  const chipStyle = useMemo(() => {
    const placementStyle =
      !isChip || placementClassName
        ? {}
        : {
            gridRow: `${displayStartDay} / ${displayEndDay + 1}`,
            gridColumn: leftZoneEndColumn ? `1 / ${leftZoneEndColumn}` : "1 / -1",
          };

    return {
      "--event-accent-color": accentColor,
      ...placementStyle,
    } as React.CSSProperties & {
      "--event-accent-color": string;
    };
  }, [accentColor, displayEndDay, displayStartDay, isChip, leftZoneEndColumn, placementClassName]);

  const isSingleDay = displayStartDay === displayEndDay;
  const spanDays = displayEndDay - displayStartDay + 1;

  return {
    displayStartDay,
    displayEndDay,
    accentColor,
    chipStyle,
    placementClassName,
    isSingleDay,
    spanDays,
  };
}

export function useEventLabels(event: CalendarEvent) {
  const startDate = parseEventBoundary(event.start, event.allDay);
  const endDate = parseEventBoundary(event.end, event.allDay);
  const endDisplayDate = event.allDay ? addDays(endDate, -1) : endDate;
  const startLabel = event.allDay ? startDate.toLocaleDateString() : startDate.toLocaleString();
  const endLabel = event.allDay ? endDisplayDate.toLocaleDateString() : endDate.toLocaleString();
  const syncState = event.syncState ?? "synced";
  const hasSyncIssue = syncState === "failed" || syncState === "conflict";
  const isPendingSync = syncState === "pending";

  return { startLabel, endLabel, syncState, hasSyncIssue, isPendingSync };
}
