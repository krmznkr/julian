export function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnlyString(value: string) {
  return DATE_ONLY_PATTERN.test(value);
}

export function parseDateInput(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 0, 0, 0, 0);
}

export function parseEventBoundary(value: string, allDay: boolean) {
  if (!allDay) {
    return new Date(value);
  }
  if (isDateOnlyString(value)) {
    return parseDateInput(value);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return parsed;
  }
  return new Date(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0);
}

export function serializeEventBoundary(date: Date, allDay: boolean) {
  return allDay ? toDateInputValue(date) : date.toISOString();
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function clampDate(date: Date, min: Date, max: Date) {
  if (date < min) return min;
  if (date > max) return max;
  return date;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function isTimedMultiDayEvent(startDate: Date, endDate: Date): boolean {
  return startOfDay(endDate).getTime() > startOfDay(startDate).getTime();
}

export function startOfYear(year: number) {
  return new Date(year, 0, 1, 0, 0, 0, 0);
}

export function startOfNextYear(year: number) {
  return new Date(year + 1, 0, 1, 0, 0, 0, 0);
}
