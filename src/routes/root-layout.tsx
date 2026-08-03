import { Outlet } from "@tanstack/react-router";
import { SkipLink } from "@/components/skip-link";
import { GlobalErrorScreen } from "@/features/shell/global-error-screen";

export function RootLayout() {
  return (
    <>
      <SkipLink />
      <Outlet />
    </>
  );
}

export function RootErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-dvh bg-background text-foreground antialiased">
      <GlobalErrorScreen error={error} onRetry={reset} />
    </div>
  );
}
