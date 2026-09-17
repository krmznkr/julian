import { getEventBounds, parseEventBoundary } from "@/domain";
import type { CalendarEvent, EventSegment } from "@/domain";

export function useChipStyle(
  segment: EventSegment,
  overrideStartDay: number | undefined,
  overrideEndDay: number | undefined,
  displayLane: number | undefined,
  fullWidth: boolean | undefined,
  variant: "chip" | "square",
  leftZoneEndColumn?: number,
  collisionLaneCount?: number,
) {
  const displayStartDay = overrideStartDay ?? segment.startDay;
  const displayEndDay = overrideEndDay ?? segment.endDay;
  const lane = displayLane ?? segment.lane;
  const denseCollision = (collisionLaneCount ?? 0) > 3;
  const laneProgress = denseCollision ? (lane - 1) / Math.max(1, (collisionLaneCount ?? 1) - 1) : 0;
  const chipStyle = {
    "--event-accent-color": segment.calendarColor ?? "#6b7280",
    ...(variant === "chip"
      ? {
          gridRow: `${displayStartDay} / ${displayEndDay + 1}`,
          gridColumn: denseCollision
            ? "1 / -1"
            : fullWidth
              ? `1 / ${leftZoneEndColumn ?? -1}`
              : `${lane} / ${lane + 1}`,
          ...(denseCollision
            ? {
                width: "32%",
                left: `${laneProgress * 68}%`,
              }
            : {}),
        }
      : {}),
  } as React.CSSProperties;
  return {
    displayStartDay,
    displayEndDay,
    chipStyle,
    isSingleDay: displayStartDay === displayEndDay,
  };
}

export function useEventLabels(event: CalendarEvent) {
  const start = parseEventBoundary(event.start, event.allDay);
  const end = parseEventBoundary(event.end, event.allDay);
  const displayEnd = event.allDay ? (getEventBounds(event)?.lastOccupiedDate ?? end) : end;
  return {
    startLabel: event.allDay ? start.toLocaleDateString() : start.toLocaleString(),
    endLabel: event.allDay ? displayEnd.toLocaleDateString() : end.toLocaleString(),
  };
}
