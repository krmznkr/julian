import type { CalendarSummary } from "@/domain";

export function isCalendarEditable(calendar: CalendarSummary) {
  return calendar.accessRole === "owner" || calendar.accessRole === "writer";
}
