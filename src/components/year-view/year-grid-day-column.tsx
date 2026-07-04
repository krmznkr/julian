import { cn } from "@/lib/utils";
import { DAYS_IN_GRID } from "@/components/year-view/constants";

export default function YearGridDayColumn({
  isCurrentYear,
  jumpDayHighlight,
  todayDay,
  todayLongLabel,
}: {
  isCurrentYear: boolean;
  jumpDayHighlight: number | null;
  todayDay: number;
  todayLongLabel: string;
}) {
  return (
    <div className="year-grid-height sticky left-0 z-20 flex w-[var(--day-gutter-width)] flex-shrink-0 flex-col border-r border-border/80 bg-card shadow-[2px_0_8px_rgba(0,0,0,0.08)]">
      <div className="year-grid-rows grid border-r border-border/80" role="presentation">
        {Array.from({ length: DAYS_IN_GRID }, (_, index) => {
          const isTodayRow = isCurrentYear && todayDay === index + 1;
          const isJumpDay = jumpDayHighlight === index + 1;

          return (
            <div
              key={`day-${index}`}
              className={cn(
                "year-grid-text-day relative flex items-center justify-center border-b border-border/80 text-foreground/70",
                isTodayRow && "font-semibold text-[var(--accent-brand)]",
                isJumpDay && "bg-primary/10 text-foreground",
              )}
              aria-label={isTodayRow ? todayLongLabel : undefined}
            >
              {isTodayRow && (
                <span
                  className="pointer-events-none absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[var(--accent-brand)]"
                  aria-hidden="true"
                />
              )}
              <span className="relative z-10">{index + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
