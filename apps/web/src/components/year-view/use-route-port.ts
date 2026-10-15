// The router port backed by TanStack Router, for the two routes that render a
// year view: the signed-in `/$year` and the shareable `/demo/$year`.
import { useCallback, useMemo } from "react";
import type { YearViewRouterPort } from "@/components/year-view/year-view-ports";
import { useNavigate, useSearch } from "@/lib/router";

export function useRoutePort(route: "/$year" | "/demo/$year"): YearViewRouterPort {
  const search = useSearch({ from: route });
  const navigate = useNavigate();

  const navigateToFocus = useCallback<YearViewRouterPort["navigate"]>(
    (target) => {
      navigate({
        to: route,
        params: { year: String(target.year) },
        search: target.search,
        replace: target.replace,
      });
    },
    [navigate, route],
  );

  return useMemo(() => ({ search, navigate: navigateToFocus }), [navigateToFocus, search]);
}
