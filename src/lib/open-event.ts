import { TASKS_CALENDAR_ID } from "@/lib/google-calendar";
import { openExternal } from "@/lib/open-external";
import type { CalendarEvent } from "@/domain";

// Clicking an event opens it in Google rather than an in-app panel. Calendar
// events have an exact htmlLink; Google Tasks expose no per-task deep link, so
// we open Google Calendar's week view around the task's date.
export function openEventInGoogle(event: CalendarEvent): void {
  if (event.calendarId === TASKS_CALENDAR_ID) {
    const [year, month, day] = event.start.split("-").map(Number);
    if (year && month && day) {
      void openExternal(`https://calendar.google.com/calendar/u/0/r/week/${year}/${month}/${day}`);
    }
    return;
  }

  if (event.htmlLink) {
    void openExternal(event.htmlLink);
  }
}

export function openDayInGoogleCalendar(year: number, month: number, day: number): void {
  void openExternal(`https://calendar.google.com/calendar/u/0/r/day/${year}/${month + 1}/${day}`);
}
