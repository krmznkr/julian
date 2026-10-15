import YearView from "@/components/year-view";
import YearViewErrorBoundary from "@/components/year-view-error-boundary";
import { SignedOutScreen } from "@/features/shell/signed-out-screen";
import { hasStoredGoogleSession } from "@/lib/session";

// fallow-ignore-next-line unused-export
export function YearPage({ year }: { year: number }) {
  if (!hasStoredGoogleSession()) return <SignedOutScreen year={year} />;
  return (
    <YearViewErrorBoundary year={year}>
      <YearView initialYear={year} initialData={null} />
    </YearViewErrorBoundary>
  );
}
