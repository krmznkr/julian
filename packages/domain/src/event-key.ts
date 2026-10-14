export function buildEventKey(eventId: string, calendarId: string) {
  return `${calendarId}::${eventId}`;
}
