import EventChip from "@/components/event-chip";
import type { EventPopoverProps } from "@/components/year-view/types";
import { useYearViewSharedData } from "@/components/year-view/year-view-context";

export default function EventPopover({
  segment,
  event,
  fullWidth,
  variant = "chip",
  displayLane,
  collisionLaneCount,
  renderMode = "full",
  showTooltip,
  leftZoneEndColumn,
  onPointerEnter,
  onFocus,
}: EventPopoverProps) {
  const { calendars } = useYearViewSharedData();

  return (
    <EventChip
      segment={segment}
      event={event}
      calendars={calendars}
      onClick={() => undefined}
      fullWidth={fullWidth}
      variant={variant}
      displayLane={displayLane}
      collisionLaneCount={collisionLaneCount}
      displayMode={renderMode}
      leftZoneEndColumn={leftZoneEndColumn}
      showTooltip={showTooltip}
      onPointerEnter={onPointerEnter}
      onFocus={onFocus}
    />
  );
}
