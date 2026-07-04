export type KeyboardCell = {
  month: number;
  day: number;
};

export function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export function clampCell(cell: KeyboardCell, year: number): KeyboardCell {
  const month = Math.min(11, Math.max(0, cell.month));
  return {
    month,
    day: Math.min(daysInMonth(year, month), Math.max(1, cell.day)),
  };
}

export function cellDomId(year: number, month: number, day: number) {
  return `year-grid-cell-${year}-${month}-${day}`;
}

export function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export function shouldHandleGridKeys(target: EventTarget | null, dayPanelOpen: boolean) {
  if (isTypingTarget(target)) return false;
  if (dayPanelOpen) return true;
  if (!(target instanceof HTMLElement)) return true;
  if (target.closest("[data-sidebar-root]")) return false;
  if (target.closest("[data-slot='dialog-content']")) return false;
  return true;
}

export function moveCellByMonths(cell: KeyboardCell, delta: number, year: number): KeyboardCell {
  const month = Math.min(11, Math.max(0, cell.month + delta));
  return {
    month,
    day: Math.min(cell.day, daysInMonth(year, month)),
  };
}

export function moveCellByMonthsClamped(
  cell: KeyboardCell,
  delta: number,
  year: number,
): KeyboardCell {
  return moveCellByMonths(cell, delta, year);
}

export type ArrowMoveStep = {
  verticalDays: number;
  horizontalMonths: number;
  yearDelta: number;
};

export function resolveArrowMoveStep(
  event: Pick<KeyboardEvent, "key" | "shiftKey" | "altKey">,
): ArrowMoveStep | null {
  const isVertical = event.key === "ArrowUp" || event.key === "ArrowDown";
  const isHorizontal = event.key === "ArrowLeft" || event.key === "ArrowRight";
  if (!isVertical && !isHorizontal) return null;

  const direction = event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;

  if (event.altKey && isHorizontal) {
    return { verticalDays: 0, horizontalMonths: 0, yearDelta: direction };
  }

  if (event.altKey && isVertical) {
    return { verticalDays: 0, horizontalMonths: direction, yearDelta: 0 };
  }

  if (event.shiftKey && isVertical) {
    return { verticalDays: direction * 7, horizontalMonths: 0, yearDelta: 0 };
  }

  if (event.shiftKey && isHorizontal) {
    return { verticalDays: 0, horizontalMonths: direction * 3, yearDelta: 0 };
  }

  if (isVertical) {
    return { verticalDays: direction, horizontalMonths: 0, yearDelta: 0 };
  }

  return { verticalDays: 0, horizontalMonths: direction, yearDelta: 0 };
}

export function applyArrowMoveStep(
  cell: KeyboardCell,
  step: ArrowMoveStep,
  year: number,
): KeyboardCell {
  if (step.yearDelta !== 0) {
    return cell;
  }

  const afterDays = step.verticalDays !== 0 ? moveCellByDays(cell, step.verticalDays, year) : cell;
  const next =
    step.horizontalMonths !== 0
      ? moveCellByMonths(afterDays, step.horizontalMonths, year)
      : afterDays;
  return next;
}

export function moveCellByDays(cell: KeyboardCell, delta: number, year: number): KeyboardCell {
  const date = new Date(year, cell.month, cell.day + delta);
  return clampCell({ month: date.getMonth(), day: date.getDate() }, date.getFullYear());
}

export function firstDayOfMonth(cell: KeyboardCell): KeyboardCell {
  return { month: cell.month, day: 1 };
}

export function lastDayOfMonth(cell: KeyboardCell, year: number): KeyboardCell {
  return { month: cell.month, day: daysInMonth(year, cell.month) };
}

/**
 * Physical digit (0–9) for a key, read from `event.code` so it survives the
 * Shift modifier — Shift+1 reports `key: "!"` but `code: "Digit1"`. Used for
 * Shift+number month navigation. Returns null for non-digit keys.
 */
export function digitFromKeyboardCode(code: string): string | null {
  const match = /^(?:Digit|Numpad)(\d)$/.exec(code);
  return match ? match[1]! : null;
}

export type DayTypeaheadResult = {
  nextBuffer: string;
  commitDay: number | null;
  pendingDay: number | null;
};

export function resolveDayTypeaheadInput({
  buffer,
  key,
  maxDay,
}: {
  buffer: string;
  key: string;
  maxDay: number;
}): DayTypeaheadResult | null {
  if (!/^\d$/.test(key)) return null;

  const digit = Number(key);
  if (buffer === "" && digit === 0) return null;

  if (buffer !== "") {
    const combined = Number(`${buffer}${key}`);
    if (combined >= 1 && combined <= maxDay) {
      return { nextBuffer: "", commitDay: combined, pendingDay: null };
    }

    const previous = Number(buffer);
    if (previous < 1 || previous > maxDay) return null;

    if (digit === 0) {
      return { nextBuffer: "", commitDay: previous, pendingDay: null };
    }

    const canStartNextNumber = digit <= 3 && digit * 10 <= maxDay;
    return {
      nextBuffer: canStartNextNumber ? key : "",
      commitDay: previous,
      pendingDay: canStartNextNumber ? digit : null,
    };
  }

  const couldBecomeTwoDigitDay = digit <= 3 && digit * 10 <= maxDay;
  return couldBecomeTwoDigitDay
    ? { nextBuffer: key, commitDay: null, pendingDay: digit }
    : { nextBuffer: "", commitDay: digit, pendingDay: null };
}

export const YEAR_GRID_SHORTCUTS = [
  { keys: "↑ ↓ ← →", action: "Move active day (or event when day details are open)" },
  { keys: "Shift ↑ ↓", action: "Move one week" },
  { keys: "Shift ← →", action: "Move three months" },
  { keys: "Alt ↑ ↓", action: "Move one month" },
  { keys: "Alt ← →", action: "Move one year" },
  { keys: "Enter", action: "Open day details, or open selected event when details are open" },
  { keys: "Space", action: "Toggle day details" },
  { keys: "[  ]", action: "Previous / next event (alternative)" },
  { keys: "Home / End", action: "First / last day of month" },
  { keys: "PgUp / PgDn", action: "Move one week" },
  { keys: "1-31", action: "Jump to day in active month" },
  { keys: "Shift 1-12", action: "Jump to month (keeps the active day)" },
  { keys: "Shift Enter", action: "Open day in Google Calendar" },
  { keys: "N", action: "Create an event on the active day" },
  { keys: "E", action: "Edit the selected event (in day details)" },
  { keys: "⌘⌫", action: "Delete the selected event (in day details)" },
  { keys: "Escape", action: "Close day details" },
  { keys: "T", action: "Jump to today" },
  { keys: "R", action: "Refresh events" },
  { keys: "Shift T", action: "Toggle theme" },
  { keys: "S", action: "Toggle sidebar" },
  { keys: "?", action: "Show keyboard shortcuts dialog" },
  { keys: "⌘K", action: "Open command palette" },
] as const;
