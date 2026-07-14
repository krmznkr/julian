import { createRootRoute, createRoute, createRouter, redirect } from "@tanstack/react-router";
import { LandingPage } from "@/routes/landing-page";
import type { ErrorComponentProps } from "@tanstack/react-router";
import type { ComponentType } from "react";
import { parseYearViewSearch, type YearViewSearch } from "@/lib/year-view-url";
import { RootErrorBoundary, RootLayout } from "@/routes/root-layout";
import { AuthCallbackPage } from "@/routes/auth-callback-page";
import { LabPage } from "@/routes/lab-page";
import { dynamic } from "@/lib/router";
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
  const parsedYear = Number(year);

  return <YearPage year={Number.isNaN(parsedYear) ? new Date().getFullYear() : parsedYear} />;
}

function todayYearRoute() {
  const today = new Date();
  return {
    year: String(today.getFullYear()),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
}

const rootRoute = createRootRoute({
  component: RootLayout,
  errorComponent: RootErrorBoundary,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: LandingPage,
});

const yearRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/year/$year",
  validateSearch: (search: Record<string, unknown>): YearViewSearch => parseYearViewSearch(search),
  beforeLoad: ({ location, params }) => {
    const today = todayYearRoute();
    const search = location.search as Record<string, unknown>;
    if (params.year === today.year && !search.month && !search.day) {
      throw redirect({
        to: "/year/$year",
        params: { year: today.year },
        search: { month: today.month, day: today.day },
      });
    }
  },
  component: YearRouteComponent,
  errorComponent: ({ error, reset }: ErrorComponentProps) => (
    <RouteErrorScreen error={error} reset={reset} context="Year view" />
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

const routeTree = rootRoute.addChildren([indexRoute, yearRoute, authCallbackRoute, labRoute]);

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: NotFoundScreen,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
