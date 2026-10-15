import YearView from "@/components/year-view";
import YearViewErrorBoundary from "@/components/year-view-error-boundary";
import { SignedOutScreen } from "@/features/shell/signed-out-screen";
import { hasStoredGoogleSession } from "@/lib/session";

export function YearPage({ year }: { year: number }) {
  if (!hasStoredGoogleSession()) return <SignedOutScreen year={year} />;
  return (
    <YearViewErrorBoundary year={year}>
      <YearView initialYear={year} initialData={null} />
    </YearViewErrorBoundary>
  );
}
