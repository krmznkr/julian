import { useMemo } from "react";
import { clampCell, type KeyboardCell } from "@/components/year-view/year-grid-keyboard";
import { useYearGridVirtualization } from "@/components/year-view/use-year-grid-virtualization";
import type { YearGridProps } from "@/components/year-view/year-grid-parts";

export function useYearGridState(props: YearGridProps) {
  const { months, calendars, year, scrollRef, monthNames } = props;

  const today = new Date();
  const isCurrentYear = year === today.getFullYear();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();

  const todayCell = useMemo((): KeyboardCell => {
    return clampCell(
      {
        month: isCurrentYear ? todayMonth : 0,
        day: isCurrentYear ? todayDay : 1,
      },
      year,
    );
  }, [isCurrentYear, todayDay, todayMonth, year]);

  const sharedDataValue = useMemo(
    () => ({
      calendars,
      monthNames,
    }),
    [calendars, monthNames],
  );

  const virtualization = useYearGridVirtualization({
    months,
    scrollRef,
  });

  return {
    isCurrentYear,
    todayDay,
    todayMonth,
    todayCell,
    sharedDataValue,
    virtualization,
  };
}
