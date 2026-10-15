import {
  createRootRoute,
  createRoute,
  createRouter,
  notFound,
  redirect,
} from "@tanstack/react-router";
import { DemoPage } from "@/routes/demo-page";
import type { ErrorComponentProps } from "@tanstack/react-router";
import type { ComponentType } from "react";
import {
  parseMonthParam,
  parseYearParam,
  parseYearViewSearch,
  todayFocus,
  type YearViewSearch,
} from "@/lib/year-view-url";
import { RootErrorBoundary, RootLayout } from "@/routes/root-layout";
import { AuthCallbackPage } from "@/routes/auth-callback-page";
import { LabPage } from "@/routes/lab-page";
import { dynamic } from "@/lib/router";
import { hasStoredGoogleSession } from "@/lib/session";
import { NotFoundScreen } from "@/features/shell/not-found-screen";
import { RouteErrorScreen } from "@/features/shell/route-error-screen";

function RouteLoading({ label }: { label: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 text-sm text-muted-foreground">
      {label}
    </main>
  );
}

const YearPage = dynamic<{ year: number }>(
  async () => ({
    default: (await import("@/routes/year-page")).YearPage as ComponentType<{ year: number }>,
  }),
  {
    loading: function YearRouteLoading() {
      return <RouteLoading label="Loading calendar..." />;
    },
  },
);

function YearRouteComponent() {
  const { year } = yearRoute.useParams();
  return <YearPage year={Number(year)} />;
}

function DemoRouteComponent() {
  const { year } = demoRoute.useParams();
  return <DemoPage year={Number(year)} />;
}

function requireYear(raw: string): number {
  const year = parseYearParam(raw);
  if (year === null) throw notFound();
  return year;
}

const rootRoute = createRootRoute({
  component: RootLayout,
  errorComponent: RootErrorBoundary,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  // In production the edge Worker answers `/` (marketing page, or a redirect
  // for a returning visitor), so this only runs under the Vite servers. Gate
  // on the synchronous credential check so nothing flashes before it.
  beforeLoad: () => {
    const today = todayFocus();
    throw hasStoredGoogleSession()
      ? redirect({
          to: "/$year",
          params: { year: String(today.year) },
          search: today.search,
          replace: true,
        })
      : redirect({ to: "/demo", replace: true });
  },
});

const yearRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$year",
  validateSearch: (search: Record<string, unknown>): YearViewSearch => parseYearViewSearch(search),
  beforeLoad: ({ location, params }) => {
    const year = requireYear(params.year);
    const today = todayFocus();
    const search = location.search as Record<string, unknown>;
    if (year === today.year && !search.month && !search.day) {
      throw redirect({ to: "/$year", params: { year: params.year }, search: today.search });
    }
  },
  component: YearRouteComponent,
  errorComponent: ({ error, reset }: ErrorComponentProps) => (
    <RouteErrorScreen error={error} reset={reset} context="Year view" />
  ),
});

// `/{yyyy}/{mm}` opens the year focused on that month. Focus lives in the
// search params, so this resolves to the canonical `/{yyyy}?month=` form.
const yearMonthRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$year/$month",
  beforeLoad: ({ location, params }) => {
    requireYear(params.year);
    const month = parseMonthParam(params.month);
    if (month === null) throw notFound();
    const search = parseYearViewSearch(location.search as Record<string, unknown>);
    throw redirect({
      to: "/$year",
      params: { year: params.year },
      search: { ...search, month, day: search.day ?? 1 },
      replace: true,
    });
  },
});

// Pre-1.0 bookmarks. The edge answers these with a 301; this covers the Vite servers.
const legacyYearRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/year/$year",
  beforeLoad: ({ location, params }) => {
    throw redirect({
      to: "/$year",
      params: { year: params.year },
      search: parseYearViewSearch(location.search as Record<string, unknown>),
      replace: true,
    });
  },
});

// The marketing site links here without knowing the current year.
const demoIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/demo",
  beforeLoad: () => {
    const today = todayFocus();
    throw redirect({
      to: "/demo/$year",
      params: { year: String(today.year) },
      search: today.search,
      replace: true,
    });
  },
});

const demoRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/demo/$year",
  validateSearch: (search: Record<string, unknown>): YearViewSearch => parseYearViewSearch(search),
  beforeLoad: ({ location, params }) => {
    const year = requireYear(params.year);
    const today = todayFocus();
    const search = location.search as Record<string, unknown>;
    if (year === today.year && !search.month && !search.day) {
      throw redirect({ to: "/demo/$year", params: { year: params.year }, search: today.search });
    }
  },
  component: DemoRouteComponent,
  errorComponent: ({ error, reset }: ErrorComponentProps) => (
    <RouteErrorScreen error={error} reset={reset} context="Demo" />
  ),
});

const authCallbackRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/auth/callback",
  component: AuthCallbackPage,
});

const labRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/lab",
  component: LabPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  yearRoute,
  yearMonthRoute,
  legacyYearRoute,
  demoIndexRoute,
  demoRoute,
  authCallbackRoute,
  labRoute,
]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFoundScreen,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
