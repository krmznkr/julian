import { memo } from "react";
import { Clock } from "lucide-react";
import { parseEventBoundary } from "@/domain";
import type { DaySquare } from "@/components/year-view/use-month-column";

const TIME = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

export const SingleDayDisplay = memo(function SingleDayDisplay({
  squares,
}: {
  squares: DaySquare[];
}) {
  const first = squares[0];
  if (!first) return null;
  const time = first.allDay ? "All day" : TIME.format(parseEventBoundary(first.event.start, false));
  return (
    <div className="flex h-full min-w-0 items-center gap-1 px-1 py-0.5 pr-4">
      <button
        type="button"
        tabIndex={-1}
        data-event-key={first.segment.id}
        aria-label={`${first.event.title}, ${time}`}
        title={`${first.event.title} · ${first.timeLabel ?? time}`}
        className="flex h-full min-w-0 flex-1 items-center gap-1 rounded-sm border-l-2 bg-background/80 px-1 text-left text-[10px] text-foreground hover:bg-accent"
        style={{ borderColor: first.event.calendarColor ?? "#8b8b8b" }}
      >
        {!first.allDay && <Clock className="size-2.5 shrink-0" aria-hidden="true" />}
        <span className="truncate">
          {!first.allDay && `${time} `}
          {first.event.title}
        </span>
      </button>
      {squares.length > 1 && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Show all ${squares.length} single-day events`}
          title={squares
            .slice(1)
            .map((square) => square.event.title)
            .join("\n")}
          className="shrink-0 rounded-sm bg-muted px-1 py-1 text-[10px] font-medium tabular-nums hover:bg-accent"
        >
          +{squares.length - 1}
        </button>
      )}
    </div>
  );
});
