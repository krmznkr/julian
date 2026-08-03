import YearView from "@/components/year-view";
import YearViewErrorBoundary from "@/components/year-view-error-boundary";

// fallow-ignore-next-line unused-export
export function YearPage({ year }: { year: number }) {
  return (
    <YearViewErrorBoundary year={year}>
      <YearView initialYear={year} initialData={null} />
    </YearViewErrorBoundary>
  );
}
