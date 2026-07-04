import { Checkbox } from "@/components/ui/checkbox";
import type { CalendarSummary } from "@/domain";
import { cn } from "@/lib/utils";

export function CalendarListSkeleton() {
  return (
    <div className="space-y-1" aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex min-h-10 items-center gap-2.5 rounded-md px-2 py-1.5">
          <div className="size-3.5 shrink-0 rounded border border-border/40 bg-muted/50 animate-pulse" />
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            <div className="h-2 w-2 shrink-0 rounded-full bg-muted/50 animate-pulse" />
            <div className="h-3 flex-1 max-w-[120px] rounded bg-muted/50 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CalendarList({
  calendars,
  selectedCalendarIds,
  onChange,
  disabled,
}: {
  calendars: CalendarSummary[];
  selectedCalendarIds: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      {calendars.map((calendar) => {
        const checked = selectedCalendarIds.includes(calendar.id);
        return (
          <div
            key={calendar.id}
            className={cn(
              "group flex min-h-10 items-center gap-1 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/55 focus-within:bg-muted/55",
              disabled && "opacity-60",
            )}
          >
            <label
              title={calendar.summary}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5"
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onCheckedChange={(next) => {
                  const isChecked = Boolean(next);
                  const updated = isChecked
                    ? [...selectedCalendarIds, calendar.id]
                    : selectedCalendarIds.filter((id) => id !== calendar.id);
                  onChange(updated);
                }}
              />
              <span className="flex min-w-0 flex-1 items-center gap-2.5">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{
                    backgroundColor: calendar.backgroundColor ?? "#8b8b8b",
                  }}
                />
                <span className="truncate text-[13px] text-foreground">{calendar.summary}</span>
              </span>
            </label>
          </div>
        );
      })}
    </div>
  );
}
