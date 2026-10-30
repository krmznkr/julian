/**
 * The screen shown while a route's code loads. `index.html` paints the same
 * classes and text inside `#root` before the app's entry module runs, so the
 * first paint does not wait for the JavaScript; React replaces it when it
 * mounts. `route-loading.test.ts` keeps the two in step.
 */
export const ROUTE_LOADING_CLASS =
  "flex min-h-dvh items-center justify-center bg-background px-6 text-sm text-muted-foreground";

export const CALENDAR_LOADING_LABEL = "Loading calendar...";

export function RouteLoading({ label }: { label: string }) {
  return <main className={ROUTE_LOADING_CLASS}>{label}</main>;
}
