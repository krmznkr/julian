import { useCallback } from "react";
import type { YearViewAction } from "@/components/year-view-reducer";
import { MAX_YEAR, MIN_YEAR } from "@/components/year-view/constants";
import { clampCell, type KeyboardCell } from "@/components/year-view/year-grid-keyboard";

/**
 * Moving around the calendar: changing year, jumping to a month, going to today.
 *
 * Every one of these is a *navigation*, not a state write — the URL is the
 * source of truth for where the view is looking, so these all funnel into
 * `navigate` rather than setting local state. The one exception is the year
 * input, which must accept half-typed years like "20" that no route would allow.
 */
export function useYearNavigation({
  year,
  initialYear,
  focusedCell,
  navigate,
  scrollToMonth,
  dispatch,
  onJumpedToToday,
}: {
  year: number;
  initialYear: number;
  /** Current focus from the URL, if any. Keeps the day steady across year changes. */
  focusedCell: KeyboardCell | undefined;
  navigate: (
    target: { year?: number; cell: KeyboardCell; detailsOpen: boolean },
    options?: { replace?: boolean },
  ) => void;
  scrollToMonth: (month: number) => void;
  dispatch: (action: YearViewAction) => void;
  onJumpedToToday: () => void;
}) {
  const defaultCell = useCallback(
    (targetYear: number): KeyboardCell => {
      if (focusedCell) return focusedCell;
      const now = new Date();
      const isCurrentYear = targetYear === now.getFullYear();
      return clampCell(
        {
          month: isCurrentYear ? now.getMonth() : 0,
          day: isCurrentYear ? now.getDate() : 1,
        },
        targetYear,
      );
    },
    [focusedCell],
  );

  const goToYear = useCallback(
    (targetYear: number) => {
      navigate(
        { year: targetYear, cell: defaultCell(targetYear), detailsOpen: false },
        { replace: false },
      );
    },
    [defaultCell, navigate],
  );

  // The input holds whatever is typed so a year can be edited digit by digit;
  // only a complete, in-range, actually-different year triggers navigation.
  const onYearChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (Number.isNaN(value)) return;
      dispatch({ type: "YEAR_CHANGED", year: value });
      if (value >= MIN_YEAR && value <= MAX_YEAR && value !== initialYear) {
        goToYear(value);
      }
    },
    [dispatch, goToYear, initialYear],
  );

  const onYearKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "ArrowUp") {
        event.preventDefault();
        goToYear(Math.min(MAX_YEAR, year + 1));
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        goToYear(Math.max(MIN_YEAR, year - 1));
      }
    },
    [goToYear, year],
  );

  const onPreviousYear = useCallback(() => goToYear(year - 1), [goToYear, year]);
  const onNextYear = useCallback(() => goToYear(year + 1), [goToYear, year]);

  const onMonthSelect = useCallback(
    (event: React.ChangeEvent<HTMLSelectElement>) => {
      const month = Number(event.target.value);
      if (Number.isNaN(month)) return;
      scrollToMonth(month);
      navigate(
        { cell: clampCell({ month, day: focusedCell?.day ?? 1 }, year), detailsOpen: false },
        { replace: true },
      );
    },
    [focusedCell?.day, navigate, scrollToMonth, year],
  );

  const onJumpToToday = useCallback(() => {
    const today = new Date();
    navigate(
      {
        year: today.getFullYear(),
        cell: clampCell({ month: today.getMonth(), day: today.getDate() }, today.getFullYear()),
        detailsOpen: false,
      },
      { replace: false },
    );
    scrollToMonth(today.getMonth());
    onJumpedToToday();
  }, [navigate, onJumpedToToday, scrollToMonth]);

  return { onYearChange, onYearKeyDown, onPreviousYear, onNextYear, onMonthSelect, onJumpToToday };
}
