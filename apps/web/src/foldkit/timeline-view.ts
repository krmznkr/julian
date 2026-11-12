import { ChevronLeft, ChevronRight } from "lucide";
import {
  buildTimelineRows,
  dateFromDayIndex,
  dayIndexInYear,
  daysInYear,
  eventCalendarSpanDays,
  formatDateRange,
  parseDateInput,
  shiftTimelineWindow,
  TASKS_CALENDAR_ID,
  TIMELINE_ZOOMS,
  type TimelineBar,
  type TimelineZoom,
} from "@julian/domain";
import {
  formatTimelineRange,
  timelineDayWidth,
  timelineLabelMode,
  timelineLabelPx,
  timelineLabelWidth,
  timelineReserveDays,
} from "@/components/year-view/timeline-layout";
import { cn } from "@/lib/utils";
import { Message, visibleEvents, type Model } from "./model";
import { act, highlighted, monthName, type Builder } from "./html";
import { icon } from "./icons";

const LANE_HEIGHT = 28;
const ROW_PADDING = 8;
const BAR_HEIGHT = LANE_HEIGHT - 6;
// The desktop sidebar (w-72) and its right border.
const SIDEBAR_WIDTH = 289;
const WEEKDAY_FORMAT = new Intl.DateTimeFormat("en-US", { weekday: "short" });
const DAY_FORMAT_SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const ZOOM_LABELS: Readonly<Record<TimelineZoom, string>> = {
  week: "Week",
  month: "Month",
  quarter: "Quarter",
  year: "Year",
};

const BUTTON_BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] touch-manipulation";
const GHOST_ICON_SM = `${BUTTON_BASE} hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50 size-11 md:size-8`;
const OUTLINE_SM = `${BUTTON_BASE} border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 h-9 gap-1.5 has-[>svg]:px-2.5 min-h-[44px] md:h-8 md:min-h-0`;

/** `n` days as a CSS length, so print can rescale the whole timeline through `--day-w`. */
const dayCalc = (days: number, extraPx = 0) =>
  extraPx === 0 ? `calc(var(--day-w) * ${days})` : `calc(var(--day-w) * ${days} + ${extraPx}px)`;

/** Black or white, whichever reads better on a `#rrggbb` fill. */
const readableTextOn = (hex: string) => {
  const match = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!match) return "#ffffff";
  const value = Number.parseInt(match[1] ?? "000000", 16);
  const channel = (shift: number) => {
    const c = ((value >> shift) & 0xff) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? "#ffffff" : "#111111";
};

const toolbar = (model: Model, rangeLabel: string, h: Builder) =>
  h.div(
    [
      h.Class(
        "flex flex-wrap items-center gap-2 border-b border-border/40 px-3 py-2 md:px-6 print:hidden",
      ),
    ],
    [
      h.div(
        [h.Class("flex items-center gap-1")],
        [
          h.button(
            [
              h.Type("button"),
              h.Class(GHOST_ICON_SM),
              h.AriaLabel(`Previous ${model.zoom}`),
              h.AriaKeyshortcuts("BracketLeft"),
              h.OnClick(act("previous-window")),
            ],
            [icon(ChevronLeft, "size-4")],
          ),
          h.button(
            [
              h.Type("button"),
              h.Class(GHOST_ICON_SM),
              h.AriaLabel(`Next ${model.zoom}`),
              h.AriaKeyshortcuts("BracketRight"),
              h.OnClick(act("next-window")),
            ],
            [icon(ChevronRight, "size-4")],
          ),
          h.button(
            [
              h.Type("button"),
              h.Class(cn(OUTLINE_SM, "ml-1 px-3 md:hidden")),
              h.OnClick(act("today")),
            ],
            ["Today"],
          ),
        ],
      ),
      h.h2(
        [
          h.Class("min-w-0 flex-1 truncate text-sm font-semibold tabular-nums md:text-base"),
          h.AriaLive("polite"),
          h.DataAttribute("testid", "timeline-range"),
        ],
        [rangeLabel],
      ),
      h.div(
        [
          h.Role("group"),
          h.AriaLabel("Zoom"),
          h.Class("flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5"),
        ],
        TIMELINE_ZOOMS.map((zoom) =>
          h.button(
            [
              h.Type("button"),
              h.AriaPressed(String(model.zoom === zoom)),
              h.OnClick(Message.ChangedZoom({ zoom })),
              h.Class(
                cn(
                  "h-8 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 md:px-3",
                  model.zoom === zoom && "bg-background text-foreground shadow-sm",
                ),
              ),
            ],
            [ZOOM_LABELS[zoom]],
          ),
        ),
      ),
    ],
  );

/** Month names, then day numbers or week ticks when there is room for them. */
const header = (
  year: number,
  dayWidth: number,
  todayIndex: number | null,
  compact: boolean,
  h: Builder,
) => {
  const days = Array.from({ length: daysInYear(year) }, (_, index) =>
    dateFromDayIndex(year, index),
  );
  const showDays = dayWidth >= 18;
  const showWeeks = !showDays && dayWidth * 7 >= 22;
  const months = Array.from({ length: 12 }, (_, month) => {
    const name = monthName(month);
    const length = new Date(year, month + 1, 0).getDate();
    return h.div(
      [
        h.Class("absolute top-0 h-full border-l border-foreground/25"),
        h.Style({
          left: dayCalc(dayIndexInYear(new Date(year, month, 1), year)),
          width: dayCalc(length),
        }),
      ],
      [
        h.span(
          [
            h.Class(
              "timeline-sticky-label sticky inline-block truncate px-1.5 pt-1 text-xs font-semibold text-foreground",
            ),
          ],
          [
            `${dayWidth * length >= 96 ? name : name.slice(0, 3)}${dayWidth * length >= 120 ? ` ${year}` : ""}`,
          ],
        ),
      ],
    );
  });
  const dayLabels = showDays
    ? days.map((date, index) =>
        h.span(
          [
            h.Class(
              cn(
                "timeline-day-label absolute bottom-0 flex h-8 flex-col items-center justify-center text-[11px] leading-none tabular-nums text-muted-foreground",
                (date.getDay() === 0 || date.getDay() === 6) && "text-muted-foreground/70",
                index === todayIndex && "invisible",
              ),
            ),
            h.Style({ left: dayCalc(index), width: dayCalc(1) }),
          ],
          [
            h.span(
              [h.Class("text-[9px] font-medium uppercase tracking-wide")],
              [
                dayWidth >= 40
                  ? WEEKDAY_FORMAT.format(date)
                  : WEEKDAY_FORMAT.format(date).slice(0, 2),
              ],
            ),
            h.span([h.Class("mt-0.5")], [String(date.getDate())]),
          ],
        ),
      )
    : [];
  const weekLabels = showWeeks
    ? days.flatMap((date, index) =>
        date.getDay() === 1
          ? [
              h.span(
                [
                  h.Class(
                    "timeline-day-label absolute bottom-0 h-6 border-l border-border/40 pl-1 pt-1 text-[11px] tabular-nums text-muted-foreground",
                  ),
                  h.Style({ left: dayCalc(index) }),
                ],
                [String(date.getDate())],
              ),
            ]
          : [],
      )
    : [];
  return h.div(
    [
      h.Class("timeline-header sticky top-0 z-20 flex border-b border-border/60 bg-background"),
      h.AriaHidden(true),
    ],
    [
      ...(compact
        ? []
        : [
            h.div(
              [
                h.Class(
                  "timeline-label-col sticky left-0 z-10 flex shrink-0 items-end border-r border-border/60 bg-background px-3 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground",
                ),
              ],
              ["Calendars"],
            ),
          ]),
      h.div(
        [
          h.Class(cn("timeline-track relative shrink-0", showDays ? "h-14" : "h-12")),
          // RevealTimeline reads the day width from the first track.
          h.Style({ "--day-width": `${dayWidth}px` }),
        ],
        [
          ...months,
          ...dayLabels,
          ...weekLabels,
          ...(todayIndex === null
            ? []
            : [
                h.span(
                  [
                    h.Class(
                      "timeline-today-chip absolute bottom-0.5 z-10 -translate-x-1/2 rounded-full bg-[var(--accent-brand-text)] px-1.5 py-px text-[11px] font-semibold tabular-nums leading-4 text-background",
                    ),
                    h.Style({ left: dayCalc(todayIndex + 0.5) }),
                  ],
                  [DAY_FORMAT_SHORT.format(dateFromDayIndex(year, todayIndex))],
                ),
              ]),
        ],
      ),
    ],
  );
};

const gridLines = (year: number, dayWidth: number, todayIndex: number | null, h: Builder) => {
  const saturdayIndex = (6 - new Date(year, 0, 1).getDay() + 7) % 7;
  const showDayLines = dayWidth >= 8;
  return h.div(
    [
      h.AriaHidden(true),
      h.Class("timeline-grid pointer-events-none absolute inset-y-0"),
      h.Style({
        left: "var(--label-w)",
        width: dayCalc(daysInYear(year)),
        ...(showDayLines
          ? {
              "background-image": [
                "linear-gradient(to right, color-mix(in oklab, var(--border) 60%, transparent) 1px, transparent 1px)",
                "linear-gradient(to right, color-mix(in oklab, var(--muted) 70%, transparent) calc(var(--day-w) * 2), transparent 0)",
              ].join(", "),
              "background-size": `var(--day-w) 100%, ${dayCalc(7)} 100%`,
              "background-position": `0 0, ${dayCalc(saturdayIndex)} 0`,
            }
          : {}),
      }),
    ],
    [
      ...Array.from({ length: 12 }, (_, month) =>
        h.span(
          [
            h.Class("absolute inset-y-0 w-px bg-foreground/25"),
            h.Style({ left: dayCalc(dayIndexInYear(new Date(year, month, 1), year)) }),
          ],
          [],
        ),
      ),
      ...(todayIndex === null
        ? []
        : [
            h.span(
              [
                h.Class("absolute inset-y-0 w-0.5 -translate-x-1/2 bg-[var(--accent-brand)]"),
                h.Style({ left: dayCalc(todayIndex + 0.5) }),
                h.DataAttribute("testid", "timeline-today"),
              ],
              [],
            ),
          ]),
    ],
  );
};

const barView = (
  model: Model,
  bar: TimelineBar,
  calendarName: string,
  calendarColor: string | undefined,
  dayWidth: number,
  tabbable: boolean,
  h: Builder,
) => {
  const { event } = bar;
  const span = bar.endIndex - bar.startIndex + 1;
  const top = ROW_PADDING / 2 + bar.lane * LANE_HEIGHT;
  const color =
    event.calendarColor ??
    calendarColor ??
    (event.calendarId === TASKS_CALENDAR_ID ? "#8b5cf6" : "#6b7280");
  const labelMode = timelineLabelMode(span * dayWidth, event.title);
  const offscreen = bar.endIndex < model.timelineStart;
  return [
    h.button(
      [
        h.Type("button"),
        h.Tabindex(tabbable ? 0 : -1),
        h.DataAttribute("timeline-key", bar.key),
        h.DataAttribute("event-chip", "true"),
        h.AriaLabel(`${event.title}, ${formatDateRange(event)}, ${calendarName}`),
        h.Title(`${event.title} · ${formatDateRange(event)}`),
        h.OnFocus(Message.SelectedEvent({ key: bar.key })),
        h.OnClick(Message.ClickedEvent({ key: bar.key })),
        h.Class(
          cn(
            "timeline-bar absolute flex items-center overflow-clip rounded px-1.5 text-left text-xs font-medium shadow-[0_0_0_1px_var(--background)] transition-[filter] hover:brightness-110 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            bar.continuesBefore && "rounded-l-none",
            bar.continuesAfter && "rounded-r-none",
          ),
        ),
        h.Style({
          "--event-accent-color": color,
          top: `${top}px`,
          height: `${BAR_HEIGHT}px`,
          left: dayCalc(bar.startIndex, 2),
          width: `max(${dayCalc(span, -4)}, 6px)`,
          background: color,
          color: readableTextOn(color),
        }),
      ],
      labelMode === "inside"
        ? [
            h.span(
              [h.Class("timeline-bar-title sticky truncate")],
              [...(bar.continuesBefore ? ["← "] : []), ...highlighted(event.title, model, h)],
            ),
          ]
        : [],
    ),
    ...(labelMode === "outside" && !offscreen
      ? [
          h.span(
            [
              h.AriaHidden(true),
              h.Class(
                "timeline-outside-label pointer-events-none absolute flex items-center truncate pl-1.5 text-xs text-foreground/80",
              ),
              h.Style({
                top: `${top}px`,
                height: `${BAR_HEIGHT}px`,
                left: `max(${dayCalc(bar.endIndex + 1)}, ${dayCalc(bar.startIndex, 7)})`,
                "max-width": `${timelineLabelPx(event.title)}px`,
              }),
            ],
            [event.title],
          ),
        ]
      : []),
  ];
};

export const timelineView = (model: Model, h: Builder) => {
  const viewportWidth = Math.max(
    320,
    model.width - (model.width >= 768 && !model.sidebarCollapsed ? SIDEBAR_WIDTH : 0),
  );
  const totalDays = daysInYear(model.year);
  const labelWidth = timelineLabelWidth(viewportWidth);
  // Phones have no room for a name column; each row names its calendar above its bars.
  const compact = labelWidth === 0;
  const dayWidth = timelineDayWidth(viewportWidth, model.zoom, model.year);
  const today = parseDateInput(model.today);
  const todayIndex = today.getFullYear() === model.year ? dayIndexInYear(today, model.year) : null;
  const rows = buildTimelineRows(
    visibleEvents(model),
    model.calendars
      .map((calendar) => calendar.id)
      .filter((id) => model.selectedCalendarIds.includes(id)),
    model.year,
    (event) => timelineReserveDays(event.title, eventCalendarSpanDays(event), dayWidth),
  );
  const start = model.timelineStart;
  const end = Math.min(
    totalDays - 1,
    dayIndexInYear(
      shiftTimelineWindow(model.zoom, dateFromDayIndex(model.year, start), 1),
      model.year,
    ) - 1,
  );
  const rangeLabel = formatTimelineRange(model.year, start, end);
  const bars = rows.flatMap((row) => row.bars);
  const tabStopKey =
    model.timelineKey !== null && bars.some((bar) => bar.key === model.timelineKey)
      ? model.timelineKey
      : (bars.find((bar) => bar.endIndex >= start) ?? bars[0])?.key;

  return h.section(
    [h.AriaLabel(`Timeline for ${model.year}`), h.Class("flex h-full min-h-0 flex-col")],
    [
      toolbar(model, rangeLabel, h),
      h.div(
        [
          h.DataAttribute("timeline-root", ""),
          h.Id("timeline-scroller"),
          h.Role("group"),
          h.Class(
            "timeline-scroll scroll-guard-x relative min-h-0 flex-1 overflow-auto scrollbar-minimal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50",
          ),
          h.Tabindex(0),
          h.AriaLabel(`Timeline, ${rangeLabel}`),
          h.AriaKeyshortcuts(
            "ArrowUp ArrowDown ArrowLeft ArrowRight Home End BracketLeft BracketRight Plus Minus N E M QuestionMark",
          ),
        ],
        [
          h.div(
            [
              h.Class("timeline-canvas relative w-max min-w-full"),
              h.Style({
                "--day-w": `${dayWidth}px`,
                "--label-w": `${labelWidth}px`,
                "--timeline-days": String(totalDays),
              }),
            ],
            [
              header(model.year, dayWidth, todayIndex, compact, h),
              h.div(
                [h.Class("relative")],
                [
                  gridLines(model.year, dayWidth, todayIndex, h),
                  ...(rows.length === 0
                    ? [
                        h.p(
                          [h.Class("sticky left-0 px-6 py-10 text-sm text-muted-foreground")],
                          [
                            "No calendars selected. Choose calendars in the sidebar to see them here.",
                          ],
                        ),
                      ]
                    : rows.map((row) => {
                        const calendar = model.calendars.find((item) => item.id === row.calendarId);
                        const name = calendar?.summary ?? row.calendarId;
                        const labelId = `timeline-row-${row.calendarId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
                        return h.div(
                          [
                            h.Role("group"),
                            h.AriaLabelledBy(labelId),
                            h.Class(cn("flex border-b border-border/50", compact && "flex-col")),
                          ],
                          [
                            h.div(
                              [
                                h.Class(
                                  cn(
                                    "sticky left-0 z-10 flex items-start gap-2 bg-background",
                                    compact
                                      ? "w-fit px-3 pt-1.5"
                                      : "timeline-label-col shrink-0 border-r border-border/60 px-3 py-2",
                                  ),
                                ),
                              ],
                              [
                                h.span(
                                  [
                                    h.AriaHidden(true),
                                    h.Class("mt-1 size-2.5 shrink-0 rounded-full"),
                                    h.Style({
                                      background: calendar?.backgroundColor ?? "#6b7280",
                                    }),
                                  ],
                                  [],
                                ),
                                h.span(
                                  [h.Class(cn("min-w-0", compact && "flex items-baseline gap-2"))],
                                  [
                                    h.span(
                                      [
                                        h.Id(labelId),
                                        h.Class("block truncate text-xs font-medium"),
                                      ],
                                      [name],
                                    ),
                                    h.span(
                                      [h.Class("block text-[11px] text-muted-foreground")],
                                      [
                                        row.bars.length === 1
                                          ? "1 event"
                                          : `${row.bars.length} events`,
                                      ],
                                    ),
                                  ],
                                ),
                              ],
                            ),
                            h.div(
                              [
                                h.Class("timeline-track relative shrink-0"),
                                h.Style({ height: `${row.lanes * LANE_HEIGHT + ROW_PADDING}px` }),
                              ],
                              row.bars.flatMap((bar) =>
                                barView(
                                  model,
                                  bar,
                                  name,
                                  calendar?.backgroundColor ?? undefined,
                                  dayWidth,
                                  bar.key === tabStopKey,
                                  h,
                                ),
                              ),
                            ),
                          ],
                        );
                      })),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
};
