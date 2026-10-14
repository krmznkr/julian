import { memo } from "react";
import type { DaySquare } from "@/components/year-view/use-month-column";

export const SingleDayDisplay = memo(function SingleDayDisplay({
  squares,
}: {
  squares: DaySquare[];
}) {
  const allDaySquares = squares.filter((square) => square.allDay);
  const first = allDaySquares[0];
  if (!first) return null;
  return (
    <div className="flex h-full min-w-0 items-center gap-1 px-1 py-0.5 pr-4">
      <button
        type="button"
        tabIndex={-1}
        data-event-key={first.segment.id}
        aria-label={`${first.event.title}, All day`}
        title={`${first.event.title} · All day`}
        className="flex h-full min-w-0 flex-1 items-center gap-1 rounded-sm border-l-2 bg-background/80 px-1 text-left text-[10px] text-foreground hover:bg-accent"
        style={{ borderColor: first.event.calendarColor ?? "#8b8b8b" }}
      >
        <span className="truncate">{first.event.title}</span>
      </button>
      {allDaySquares.length > 1 && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Show all ${allDaySquares.length} all-day events`}
          title={allDaySquares
            .slice(1)
            .map((square) => square.event.title)
            .join("\n")}
          className="shrink-0 rounded-sm bg-muted px-1 py-1 text-[10px] font-medium tabular-nums hover:bg-accent"
        >
          +{allDaySquares.length - 1}
        </button>
      )}
    </div>
  );
});
