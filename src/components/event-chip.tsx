import { memo, useMemo } from "react";
import { Tooltip, TooltipTrigger } from "@/components/tooltip";
import {
  eventCalendarSpanDays,
  formatDateRange,
  formatTimeRange,
  ROW_HEIGHT,
} from "@/components/year-helpers";
import { useChipStyle, useEventLabels } from "@/components/use-event-chip";
import {
  type EventChipProps,
  getChipClassName,
  EventChipContent,
  EventChipMetadata,
  EventChipTooltip,
} from "@/components/event-chip-parts";
import { cn } from "@/lib/utils";
import { parseEventBoundary } from "@/domain";

function EventChip({
  segment,
  event,
  calendars,
  onClick,
  overrideStartDay,
  overrideEndDay,
  fullWidth,
  variant = "chip",
  displayMode = "full",
  displayLane,
  collisionLaneCount,
  leftZoneEndColumn,
  showTooltip = true,
  onPointerEnter,
  onFocus,
  ref,
}: EventChipProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const isSquare = variant === "square";
  const calendar = calendars.find((item) => item.id === event.calendarId);
  const { startLabel, endLabel } = useEventLabels(event);
  const { displayStartDay, displayEndDay, chipStyle, isSingleDay } = useChipStyle(
    segment,
    overrideStartDay,
    overrideEndDay,
    displayLane,
    fullWidth,
    variant,
    leftZoneEndColumn,
    collisionLaneCount,
  );
  const totalEventDays = useMemo(() => eventCalendarSpanDays(event), [event]);
  const timedInsets = useMemo(() => {
    if (event.allDay || !segment.isMultiDay) return {};
    const start = parseEventBoundary(event.start, false);
    const end = parseEventBoundary(event.end, false);
    const startFraction = (start.getHours() * 60 + start.getMinutes()) / (24 * 60);
    const endFraction = (end.getHours() * 60 + end.getMinutes()) / (24 * 60);
    return {
      marginTop: segment.isFirstSegment ? startFraction * ROW_HEIGHT + 1 : 1,
      marginBottom:
        segment.isLastSegment && endFraction > 0 ? (1 - endFraction) * ROW_HEIGHT + 1 : 1,
    };
  }, [
    event.allDay,
    event.start,
    event.end,
    segment.isMultiDay,
    segment.isFirstSegment,
    segment.isLastSegment,
  ]);
  const resolvedChipStyle = useMemo(() => {
    const color = segment.calendarColor ?? calendar?.backgroundColor ?? null;
    return {
      ...chipStyle,
      ...timedInsets,
      ...(color ? { "--event-accent-color": color } : {}),
    } as typeof chipStyle;
  }, [chipStyle, timedInsets, segment.calendarColor, calendar?.backgroundColor]);

  if (isSquare) {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        onPointerEnter={onPointerEnter}
        onFocus={onFocus}
        data-event-chip="true"
        aria-label={`${segment.title}, ${formatDateRange(event)}`}
        title={segment.title}
        className={getChipClassName(variant, fullWidth, event.allDay)}
        style={resolvedChipStyle}
      />
    );
  }

  const chipButton = (
    <button
      ref={ref}
      type="button"
      tabIndex={-1}
      onClick={onClick}
      data-event-chip="true"
      data-event-key={segment.id}
      aria-label={`${segment.title}, ${formatDateRange(event)}, ${formatTimeRange(event)}${event.allDay && totalEventDays > 1 ? `, ${totalEventDays} days` : ""}`}
      title={`${event.title} · ${formatDateRange(event)} · ${formatTimeRange(event)}`}
      className={cn(
        getChipClassName(variant, fullWidth, event.allDay),
        collisionLaneCount !== undefined && collisionLaneCount > 3 && "event-bar-dense",
        segment.isFirstSegment === false && "rounded-t-none border-t-dashed",
        segment.isLastSegment === false && "rounded-b-none border-b-dashed",
      )}
      style={resolvedChipStyle}
    >
      <EventChipContent
        title={`${segment.isFirstSegment === false ? "↑ " : ""}${segment.title}${segment.isLastSegment === false ? " ↓" : ""}`}
        displayMode={displayMode}
      />
      {!event.allDay && displayMode === "full" && !isSingleDay && (
        <span className="event-bar-time truncate text-[9px] text-muted-foreground">
          {formatTimeRange(event)}
        </span>
      )}
      <EventChipMetadata
        hasDescription={!!event.description}
        displayMode={displayMode}
        isSingleDay={isSingleDay}
        totalEventDays={event.allDay ? totalEventDays : 0}
        displayStartDay={displayStartDay}
        displayEndDay={displayEndDay}
      />
    </button>
  );

  if (!showTooltip) {
    return chipButton;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{chipButton}</TooltipTrigger>
      <EventChipTooltip
        event={event}
        calendar={calendar}
        startLabel={startLabel}
        endLabel={endLabel}
        durationDays={totalEventDays}
      />
    </Tooltip>
  );
}

export default memo(EventChip);
