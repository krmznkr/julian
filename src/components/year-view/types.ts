import type { CalendarEvent, CalendarSummary, EventSegment } from "@/domain";

export type YearViewInitialData = {
  calendars: CalendarSummary[];
  selectedCalendarIds: string[];
  events: CalendarEvent[];
};

export type EventPopoverProps = {
  segment: EventSegment;
  event: CalendarEvent;
  canEdit: boolean;
  month: number;
  fullWidth?: boolean;
  leftZoneEndColumn?: number;
  variant?: "chip" | "square";
  displayLane?: number;
  renderMode?: "full" | "compact" | "micro";
  showTooltip?: boolean;
  onPointerEnter?: () => void;
  onFocus?: () => void;
};
