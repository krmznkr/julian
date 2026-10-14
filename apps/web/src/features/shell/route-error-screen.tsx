import { GlobalErrorScreen } from "@/features/shell/global-error-screen";

export function RouteErrorScreen({
  error,
  reset,
  context,
}: {
  error: Error;
  reset: () => void;
  context: string;
}) {
  return (
    <GlobalErrorScreen
      error={error}
      onRetry={reset}
      eyebrow={`${context} error`}
      title={`We couldn't finish loading ${context.toLowerCase()}`}
      description="Try again first. If the problem persists, go back home and reopen the section from a fresh navigation."
      homeLabel="Go home"
    />
  );
}
