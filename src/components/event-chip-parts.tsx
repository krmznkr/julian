import { FileText, Repeat } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { TooltipContent } from "@/components/tooltip";
import { formatDateRange } from "@/components/year-helpers";
import { openExternal } from "@/lib/open-external";
import type { CalendarEvent, CalendarSummary, EventSegment } from "@/domain";
import { cn } from "@/lib/utils";

export interface EventChipProps {
  segment: EventSegment;
  event: CalendarEvent;
  calendars: ReadonlyArray<CalendarSummary>;
  onClick: (event?: ReactMouseEvent<HTMLButtonElement>) => void;
  overrideStartDay?: number;
  overrideEndDay?: number;
  fullWidth?: boolean;
  /** Grid line (1-based) where the timed zone starts; chips must not span past it. */
  leftZoneEndColumn?: number;
  /** "square" renders a compact tile for single-day events inside the day strip. */
  variant?: "chip" | "square";
  displayMode?: "full" | "compact" | "micro";
  displayLane?: number;
  collisionLaneCount?: number;
  showTooltip?: boolean;
  onPointerEnter?: () => void;
  onFocus?: () => void;
}

// Multi-day bars and single-day all-day chips are hollow outlines so the day
// timeline stays visible underneath.
function getOutlineEventClassName(compact = false) {
  return cn(
    "border border-l-[3px] border-[var(--event-accent-color)] bg-[color-mix(in_srgb,var(--event-accent-color)_12%,var(--background))] text-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    compact
      ? "year-grid-text-micro flex h-3 max-w-full shrink items-center overflow-hidden rounded-[3px] px-1"
      : "event-bar group pointer-events-auto relative my-0.5 flex min-h-0 cursor-pointer touch-none flex-col overflow-hidden rounded-[4px] px-1 py-0.5 text-left text-xs font-medium focus-visible:ring-ring/60",
  );
}

export function getChipClassName(
  variant: "chip" | "square",
  fullWidth?: boolean,
  allDay?: boolean,
) {
  const isSquare = variant === "square";
  return cn(
    !isSquare && getOutlineEventClassName(),
    isSquare &&
      "size-4 shrink-0 touch-none rounded-[5px] border-2 shadow-sm transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
    isSquare &&
      (allDay
        ? "border-[var(--event-accent-color)] bg-[var(--event-accent-color)]"
        : "border-[var(--event-accent-color)] bg-transparent"),
    !isSquare && (fullWidth ? "mx-0" : "mx-0.5"),
  );
}

function getCompactTitle(title: string) {
  const withoutBracketPrefix = title.replace(/^\[[^\]]+\]\s*/, "").trim();
  return withoutBracketPrefix || title.trim();
}

interface EventChipContentProps {
  title: string;
  displayMode: "full" | "compact" | "micro";
}

export function EventChipContent({ title, displayMode }: EventChipContentProps) {
  const compactTitle = getCompactTitle(title);

  return (
    <span
      className={cn(
        "event-bar-title overflow-hidden text-xs",
        displayMode === "micro" && "year-grid-text-caption leading-tight",
        displayMode === "compact" && "leading-tight",
        displayMode === "full" && "leading-snug",
      )}
    >
      {compactTitle}
    </span>
  );
}

interface EventChipMetadataProps {
  hasDescription: boolean;
  displayMode: "full" | "compact" | "micro";
  isSingleDay: boolean;
  totalEventDays: number;
  displayStartDay: number;
  displayEndDay: number;
}

export function EventChipMetadata({
  hasDescription,
  displayMode,
  isSingleDay,
  totalEventDays,
  displayStartDay,
  displayEndDay,
}: EventChipMetadataProps) {
  const metaLine = [
    ...(!isSingleDay ? [`${displayStartDay}–${displayEndDay}`] : []),
    ...(totalEventDays > 1 ? [`${totalEventDays} days`] : []),
  ].join(" · ");
  const showMetaRow = displayMode === "full" && metaLine.length > 0;

  return (
    <>
      {hasDescription && displayMode === "full" && (
        <span
          className="absolute right-2 bottom-1.5 opacity-0 transition-opacity group-hover:opacity-60"
          aria-label="Has description"
          title="Has description"
        >
          <FileText className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
        </span>
      )}
      {showMetaRow && (
        <span
          className={cn(
            "event-bar-meta mt-auto text-[10px] font-normal opacity-70 shrink-0",
            displayMode !== "full" && "leading-none",
          )}
        >
          {metaLine}
        </span>
      )}
    </>
  );
}

interface EventChipTooltipProps {
  event: CalendarEvent;
  calendar: CalendarSummary | undefined;
  startLabel: string;
  endLabel: string;
  durationDays: number;
}

export function EventChipTooltip({
  event,
  calendar,
  startLabel,
  endLabel,
  durationDays,
}: EventChipTooltipProps) {
  return (
    <TooltipContent
      className="z-50 w-72 rounded-[12px] border border-border bg-popover px-3 py-2 text-xs text-foreground shadow-lg"
      sideOffset={8}
    >
      <div className="space-y-2">
        <div>
          <p className="line-clamp-2 text-sm font-medium text-foreground">{event.title}</p>
          {event.description && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {event.description.substring(0, 100)}
              {event.description.length > 100 ? "…" : ""}
            </p>
          )}
          <p className="line-clamp-2 text-muted-foreground">{formatDateRange(event)}</p>
          {event.allDay && durationDays > 1 && (
            <p className="mt-0.5 text-muted-foreground">{durationDays} days</p>
          )}
        </div>
        <div className="space-y-1 text-muted-foreground">
          <p className="truncate">{calendar?.summary ?? "Calendar"}</p>
          <p>{event.allDay ? "All-day" : "Timed"}</p>
          {event.recurringEventId && (
            <p className="flex items-center gap-1.5">
              <Repeat className="h-3 w-3" aria-hidden="true" />
              <span>Recurring event</span>
            </p>
          )}
        </div>
        <div className="space-y-1 text-muted-foreground">
          <p className="truncate">Start: {startLabel}</p>
          <p className="truncate">End: {endLabel}</p>
        </div>
        {event.htmlLink && (
          <div className="pt-1">
            <a
              className="rounded-full border border-border/70 bg-background px-2.5 py-1 text-[11px] font-medium text-foreground underline decoration-foreground/30 underline-offset-2 transition hover:border-border hover:bg-muted hover:decoration-foreground/60"
              href={event.htmlLink}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => {
                // Route through the opener helper (opens a new browser tab).
                e.preventDefault();
                if (event.htmlLink) void openExternal(event.htmlLink);
              }}
            >
              Open event link
            </a>
          </div>
        )}
      </div>
    </TooltipContent>
  );
}
