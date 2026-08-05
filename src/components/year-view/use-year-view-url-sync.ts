import { useCallback, useMemo, useRef } from "react";
import { clampCell } from "@/components/year-view/year-grid-keyboard";
import { MAX_YEAR, MIN_YEAR } from "@/components/year-view/constants";
import type { KeyboardCell } from "@/components/year-view/year-grid-keyboard";
import type { YearViewRouterPort } from "@/components/year-view/year-view-ports";
import { buildYearViewSearch, cellFromYearViewSearch, focusSignature } from "@/lib/year-view-url";

export type YearViewUrlFocus = {
  cell: KeyboardCell;
  detailsOpen: boolean;
};

export function useYearViewUrlSync(year: number, router: YearViewRouterPort) {
  const { search, navigate } = router;
  const lastWrittenSignatureRef = useRef<string | null>(null);

  const urlFocus = useMemo((): YearViewUrlFocus | null => {
    const cell = cellFromYearViewSearch(year, search);
    if (!cell) return null;
    return { cell, detailsOpen: search.details === true };
  }, [search, year]);

  const navigateYearView = useCallback(
    (
      next: {
        year?: number;
        cell: KeyboardCell;
        detailsOpen: boolean;
      },
      options?: { replace?: boolean },
    ) => {
      const targetYear = Math.min(MAX_YEAR, Math.max(MIN_YEAR, next.year ?? year));
      const cell = clampCell(next.cell, targetYear);
      const searchParams = buildYearViewSearch({
        cell,
        detailsOpen: next.detailsOpen,
      });
      const signature = focusSignature({ cell, detailsOpen: next.detailsOpen });
      // eslint-disable-next-line functional/immutable-data
      lastWrittenSignatureRef.current = signature;

      navigate({
        year: targetYear,
        search: searchParams,
        replace: options?.replace ?? true,
      });
    },
    [navigate, year],
  );

  const shouldApplyUrlFocus = useCallback((focus: YearViewUrlFocus | null) => {
    if (!focus) return false;
    const signature = focusSignature(focus);
    return signature !== lastWrittenSignatureRef.current;
  }, []);

  const markUrlFocusApplied = useCallback((focus: YearViewUrlFocus) => {
    // eslint-disable-next-line functional/immutable-data
    lastWrittenSignatureRef.current = focusSignature(focus);
  }, []);

  return {
    urlFocus,
    navigateYearView,
    shouldApplyUrlFocus,
    markUrlFocusApplied,
  };
}
