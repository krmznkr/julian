import {
  eventCalendarSpanDays,
  formatDateRange,
  formatTimeRange,
  type EventSegment,
} from "@julian/domain";
import { FileText } from "lucide";
import { cn } from "@/lib/utils";
import { icon } from "./icons";
import { Message, canModify, type Event, type Model } from "./model";
import type { Builder } from "./html";

export type RenderMode = "full" | "compact" | "micro";

const highlightParts = (title: string, query: string) => {
  const needle = query.trim().toLocaleLowerCase();
  const step = (from: number): readonly { readonly text: string; readonly match: boolean }[] => {
    const at = needle ? title.toLocaleLowerCase().indexOf(needle, from) : -1;
    if (at < 0) return from < title.length ? [{ text: title.slice(from), match: false }] : [];
    const end = at + needle.length;
    return [
      ...(at > from ? [{ text: title.slice(from, at), match: false }] : []),
      { text: title.slice(at, end), match: true },
      ...step(end),
    ];
  };
  return step(0);
};

const highlightedText = (text: string, model: Model, h: Builder) =>
  highlightParts(text, model.query).map((part) =>
    part.match
      ? h.mark(
          [h.Class("rounded-sm bg-yellow-300/80 px-px text-inherit dark:bg-yellow-500/60")],
          [part.text],
        )
      : part.text,
  );

const compactTitle = (title: string) => title.replace(/^\[[^\]]+\]\s*/, "").trim() || title.trim();

export const eventChip = (
  model: Model,
  segment: EventSegment,
  event: Event,
  options: {
    readonly lane: number;
    readonly laneCount: number;
    readonly fullWidth: boolean;
    readonly displayMode: RenderMode;
  },
  h: Builder,
) => {
  const { lane, laneCount, fullWidth, displayMode } = options;
  const isSingleDay = segment.startDay === segment.endDay;
  const dense = laneCount > 3;
  const laneProgress = dense ? (lane - 1) / Math.max(1, laneCount - 1) : 0;
  const totalEventDays = event.allDay ? eventCalendarSpanDays(event) : 0;
  const metaLine = [
    ...(isSingleDay ? [] : [`${segment.startDay}–${segment.endDay}`]),
    ...(totalEventDays > 1 ? [`${totalEventDays} days`] : []),
  ].join(" · ");
  const color =
    segment.calendarColor ??
    model.calendars.find((calendar) => calendar.id === event.calendarId)?.backgroundColor ??
    "#6b7280";
  const title = `${segment.isFirstSegment === false ? "↑ " : ""}${segment.title}${segment.isLastSegment === false ? " ↓" : ""}`;
  return h.keyed("button")(
    segment.id,
    [
      h.Type("button"),
      h.Tabindex(-1),
      h.Title(`${event.title} · ${formatDateRange(event)} · ${formatTimeRange(event)}`),
      h.DataAttribute("event-chip", "true"),
      h.DataAttribute("event-key", segment.id),
      h.Draggable(event.allDay && canModify(model, event)),
      h.Class(
        cn(
          "calendar-event",
          "border border-l-[3px] border-[var(--event-accent-color)] bg-[color-mix(in_srgb,var(--event-accent-color)_12%,var(--background))] text-foreground transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          "event-bar group pointer-events-auto relative my-0.5 flex min-h-0 cursor-pointer touch-none flex-col overflow-hidden rounded-[4px] px-1 py-0.5 text-left text-xs font-medium focus-visible:ring-ring/60",
          fullWidth ? "mx-0" : "mx-0.5",
          dense && "event-bar-dense",
          segment.isFirstSegment === false && "rounded-t-none border-t-dashed",
          segment.isLastSegment === false && "rounded-b-none border-b-dashed",
        ),
      ),
      h.Style({
        "--event-accent-color": color,
        "grid-row": `${segment.startDay} / ${segment.endDay + 1}`,
        "grid-column": dense ? "1 / -1" : fullWidth ? "1 / -1" : `${lane} / ${lane + 1}`,
        ...(dense ? { width: "32%", left: `${laneProgress * 68}%` } : {}),
      }),
      h.OnClick(Message.ClickedEvent({ key: segment.id })),
    ],
    [
      h.span(
        [
          h.Class(
            cn(
              "event-bar-title overflow-hidden text-xs",
              displayMode === "micro" && "year-grid-text-caption leading-tight",
              displayMode === "compact" && "leading-tight",
              displayMode === "full" && "leading-snug",
            ),
          ),
        ],
        highlightedText(compactTitle(title), model, h),
      ),
      ...(!event.allDay && displayMode === "full" && !isSingleDay
        ? [
            h.span(
              [h.Class("event-bar-time truncate text-[9px] text-muted-foreground")],
              [formatTimeRange(event)],
            ),
          ]
        : []),
      ...(event.description && displayMode === "full"
        ? [
            h.span(
              [
                h.Class(
                  "absolute right-2 bottom-1.5 opacity-0 transition-opacity group-hover:opacity-60",
                ),
                h.AriaLabel("Has description"),
                h.Title("Has description"),
              ],
              [icon(FileText, "h-3 w-3 text-muted-foreground")],
            ),
          ]
        : []),
      ...(displayMode === "full" && metaLine.length > 0
        ? [
            h.span(
              [h.Class("event-bar-meta mt-auto shrink-0 text-[10px] font-normal opacity-70")],
              [metaLine],
            ),
          ]
        : []),
    ],
  );
};
