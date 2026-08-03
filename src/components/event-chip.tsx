import { memo, useMemo } from "react";
import { Tooltip, TooltipTrigger } from "@/components/tooltip";
import { eventCalendarSpanDays, formatDateRange } from "@/components/year-helpers";
import { useChipStyle, useEventLabels } from "@/components/use-event-chip";
import {
  type EventChipProps,
  getChipClassName,
  EventChipContent,
  EventChipMetadata,
  EventChipTooltip,
} from "@/components/event-chip-parts";
import { cn } from "@/lib/utils";

function EventChip({
  segment,
  event,
  month: _month,
  calendars,
  onClick,
  overrideStartDay,
  overrideEndDay,
  fullWidth,
  variant = "chip",
  displayMode = "full",
  displayLane,
  leftZoneEndColumn,
  showTooltip = true,
  onPointerEnter,
  onFocus,
  ref,
}: EventChipProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const isSquare = variant === "square";
  const calendar = calendars.find((item) => item.id === event.calendarId);
  const { startLabel, endLabel, syncState, hasSyncIssue, isPendingSync } = useEventLabels(event);
  const { displayStartDay, displayEndDay, chipStyle, placementClassName, isSingleDay } =
    useChipStyle(
      segment,
      overrideStartDay,
      overrideEndDay,
      displayLane,
      fullWidth,
      variant,
      leftZoneEndColumn,
    );
  const totalEventDays = useMemo(() => eventCalendarSpanDays(event), [event]);
  const resolvedChipStyle = useMemo(() => {
    const color = segment.calendarColor ?? calendar?.backgroundColor ?? null;
    if (!color) return chipStyle;
    return { ...chipStyle, "--event-accent-color": color } as typeof chipStyle;
  }, [chipStyle, segment.calendarColor, calendar?.backgroundColor]);

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
      aria-label={`${segment.title}, ${formatDateRange(event)}${totalEventDays > 1 ? `, ${totalEventDays} days` : ""}`}
      title={segment.title}
      className={cn(getChipClassName(variant, fullWidth, event.allDay), placementClassName)}
      style={resolvedChipStyle}
    >
      <EventChipContent title={segment.title} displayMode={displayMode} />
      <EventChipMetadata
        hasDescription={!!event.description}
        displayMode={displayMode}
        isPendingSync={isPendingSync}
        hasSyncIssue={hasSyncIssue}
        isSingleDay={isSingleDay}
        totalEventDays={totalEventDays}
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
        syncState={syncState}
      />
    </Tooltip>
  );
}

export default memo(EventChip);
