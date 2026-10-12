import type { CalendarEvent, CalendarSummary, EventSegment } from "@/domain";

export type YearViewInitialData = {
  readonly calendars: ReadonlyArray<CalendarSummary>;
  readonly selectedCalendarIds: ReadonlyArray<string>;
  readonly events: ReadonlyArray<CalendarEvent>;
};

export type EventPopoverProps = {
  segment: EventSegment;
  event: CalendarEvent;
  canEdit: boolean;
  fullWidth?: boolean;
  leftZoneEndColumn?: number;
  variant?: "chip" | "square";
  displayLane?: number;
  collisionLaneCount?: number;
  renderMode?: "full" | "compact" | "micro";
  showTooltip?: boolean;
  onPointerEnter?: () => void;
  onFocus?: () => void;
};
