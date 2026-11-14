import {
  buildMonthSegments,
  isWeekend,
  toDateInputValue,
  type MonthSegments,
} from "@julian/domain";
import { cellDomId } from "@/year-view/year-grid-keyboard";
import { visibleYearEventLaneMap } from "@/year-view/month-grid-layout";
import { cn } from "@/lib/utils";
import { Message, eventKey, visibleEvents, type Model } from "./model";
import { dateLabel, monthName, type Builder } from "./html";
import { eventChip, type RenderMode } from "./event-chip";

const DAYS_IN_GRID = 31;
const MONTH_HEADER_HEIGHT = "32px";
const LEGEND_HEIGHT = "20px";

const templateColumns = (lanes: number) => `repeat(${Math.max(1, lanes)}, minmax(0, 1fr))`;

const todayLongLabel = (date: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );

const dayCell = (
  model: Model,
  month: number,
  day: number,
  state: { readonly exists: boolean; readonly isToday: boolean },
  h: Builder,
) => {
  const { exists, isToday } = state;
  const date = toDateInputValue(new Date(model.year, month, day));
  const isFocused = exists && model.date === date;
  const weekend = exists && isWeekend(model.year, month, day);
  return h.keyed("div")(
    `day-${day}`,
    [
      ...(exists
        ? [h.Id(cellDomId(model.year, month, day)), h.OnClick(Message.ClickedDate({ date }))]
        : []),
      h.DataAttribute("day-cell-frame", String(day)),
      ...(isFocused && model.details ? [h.AriaCurrent("true")] : []),
      h.Style({ "grid-row": `${day} / ${day + 1}`, "grid-column": "1 / -1" }),
      h.Class(
        cn(
          "relative min-w-0 border-b border-border/80",
          !exists && "border-b-0",
          weekend && "bg-muted/80 dark:bg-muted/60",
          exists && isToday && "bg-[var(--accent-brand)]/5",
          isFocused &&
            "z-30 rounded-[3px] ring-2 ring-inset ring-[var(--accent-brand)] bg-[var(--accent-brand)]/12",
        ),
      ),
    ],
    exists
      ? [
          h.span(
            [
              h.Class(
                cn(
                  "year-grid-text-micro pointer-events-none absolute right-0.5 top-0.5 z-20 select-none rounded-[2px] px-0.5 tabular-nums text-foreground/60",
                  isToday && "font-semibold text-[var(--accent-brand-text)]",
                  isFocused && "text-foreground/80",
                ),
              ),
              h.AriaHidden(true),
            ],
            [String(day)],
          ),
          ...(isToday && !isFocused
            ? [
                h.span(
                  [
                    h.Class(
                      "pointer-events-none absolute left-0 top-0 h-full w-0.5 bg-[var(--accent-brand)]/70",
                    ),
                    h.AriaHidden(true),
                  ],
                  [],
                ),
              ]
            : []),
          ...(isFocused
            ? [
                h.span(
                  [
                    h.Class(
                      "pointer-events-none absolute left-0 top-0 h-full w-1 rounded-l-[3px] bg-[var(--accent-brand)]",
                    ),
                    h.AriaHidden(true),
                  ],
                  [],
                ),
              ]
            : []),
        ]
      : [],
  );
};

const monthColumn = (model: Model, month: MonthSegments, h: Builder) => {
  const { lanes, laneCount } = visibleYearEventLaneMap(month.segments);
  const daysInMonth = new Date(model.year, month.month + 1, 0).getDate();
  const todayDay =
    model.today.startsWith(`${model.year}-`) && Number(model.today.slice(5, 7)) - 1 === month.month
      ? Number(model.today.slice(8, 10))
      : null;
  const renderMode: RenderMode = laneCount >= 7 ? "micro" : laneCount >= 5 ? "compact" : "full";
  const bars = month.segments.flatMap((segment) => {
    const event = model.events.find((item) => eventKey(item) === segment.id);
    return event && (event.allDay || segment.isMultiDay) ? [{ segment, event }] : [];
  });
  return h.keyed("div")(
    `month-${month.month}`,
    [
      h.DataAttribute("month-column", String(month.month)),
      h.Class(
        "year-grid-height flex w-[var(--month-col-width)] shrink-0 flex-col border-r border-border/80 bg-background [content-visibility:auto]",
      ),
    ],
    [
      h.div(
        [h.Class("relative h-full")],
        [
          h.div(
            [h.Class("absolute inset-0")],
            [
              h.div(
                [
                  h.Class(
                    "year-grid-rows absolute inset-0 z-0 grid gap-x-0 gap-y-0 overflow-hidden",
                  ),
                  h.Style({ "grid-template-columns": templateColumns(laneCount) }),
                ],
                Array.from({ length: DAYS_IN_GRID }, (_, index) =>
                  dayCell(
                    model,
                    month.month,
                    index + 1,
                    {
                      exists: index + 1 <= daysInMonth,
                      isToday: todayDay === index + 1,
                    },
                    h,
                  ),
                ),
              ),
              h.div(
                [
                  h.Class(
                    "year-grid-rows pointer-events-none absolute inset-0 z-20 grid gap-x-0 gap-y-0 overflow-hidden",
                  ),
                  h.Style({ "grid-template-columns": templateColumns(laneCount) }),
                ],
                bars.map(({ segment, event }) =>
                  eventChip(
                    model,
                    segment,
                    event,
                    {
                      lane: lanes.get(segment.id) ?? 1,
                      laneCount,
                      fullWidth: laneCount <= 1,
                      displayMode: renderMode,
                    },
                    h,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    ],
  );
};

const gutterCell = (h: Builder) =>
  h.div(
    [
      h.Class(
        "sticky left-0 z-20 w-[var(--day-gutter-width)] shrink-0 border-r border-border/80 bg-background/90 backdrop-blur",
      ),
      h.AriaHidden(true),
    ],
    [],
  );

export const gridView = (model: Model, h: Builder) => {
  const months = buildMonthSegments(visibleEvents(model), model.year);
  const activeMonth = Number(model.date.slice(5, 7)) - 1;
  const first = model.printing ? 0 : Math.min(model.firstMonth, activeMonth);
  const last = model.printing ? 11 : Math.max(model.lastMonth, activeMonth);
  const visible = months.slice(first, last + 1);
  const isCurrentYear = model.today.startsWith(`${model.year}-`);
  const todayMonth = Number(model.today.slice(5, 7)) - 1;
  const todayDay = Number(model.today.slice(8, 10));
  const isCurrentMonth = (month: number) => isCurrentYear && month === todayMonth;
  const spacer = (count: number, key: string) =>
    count > 0
      ? [
          h.keyed("div")(
            key,
            [
              h.Class("shrink-0"),
              h.Style({
                width: `calc(${count} * var(--month-col-width) + ${(count - 1) * 4}px)`,
              }),
              h.AriaHidden(true),
            ],
            [],
          ),
        ]
      : [];
  const headerRow = (
    key: string,
    height: string,
    className: string,
    cell: (month: MonthSegments) => ReturnType<Builder["div"]>,
  ) =>
    h.div(
      [h.Class(cn("flex min-w-max gap-1", className)), h.Style({ height })],
      [
        gutterCell(h),
        ...spacer(first, `${key}-before`),
        ...visible.map(cell),
        ...spacer(11 - last, `${key}-after`),
      ],
    );

  return h.section(
    [h.Role("region"), h.AriaLabel(`Calendar for ${model.year}`), h.Class("h-full w-full")],
    [
      h.div(
        [h.Class("flex h-full min-h-0")],
        [
          h.div(
            [
              h.Id("year-application"),
              h.Role("application"),
              h.Tabindex(0),
              h.AriaLabel(`Calendar for ${model.year}`),
              h.AriaKeyshortcuts(
                "ArrowUp ArrowDown ArrowLeft ArrowRight Enter Space BracketLeft BracketRight Home End PageUp PageDown Escape QuestionMark N E R 0 1 2 3 4 5 6 7 8 9 Meta+Backspace",
              ),
              h.AriaActiveDescendant(
                cellDomId(model.year, activeMonth, Number(model.date.slice(8, 10))),
              ),
              h.DataAttribute("year-grid-root", ""),
              h.DataAttribute("year", String(model.year)),
              h.Class(
                "year-grid scroll-guard-x relative flex h-full w-full min-w-0 flex-col overflow-auto font-sans scrollbar-minimal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              ),
            ],
            [
              h.p(
                [h.Class("sr-only"), h.AriaLive("polite"), h.AriaAtomic(true)],
                [dateLabel(model.date)],
              ),
              h.div(
                [h.Class("flex min-h-full min-w-max flex-1 flex-col px-[var(--grid-pad-x)] pb-4")],
                [
                  h.div(
                    [
                      h.DataAttribute("year-grid-header", ""),
                      h.Class(
                        "sticky top-0 z-20 min-w-max border-b border-border/80 bg-background/95 shadow-sm backdrop-blur",
                      ),
                    ],
                    [
                      headerRow("heading", MONTH_HEADER_HEIGHT, "", (month) =>
                        h.keyed("div")(
                          `header-${month.month}`,
                          [
                            h.DataAttribute("month-header", String(month.month)),
                            h.Class(
                              cn(
                                "flex w-[var(--month-col-width)] shrink-0 items-center border-r border-border/80 px-2 text-xs text-foreground/70 sm:px-2.5",
                                isCurrentMonth(month.month) && "bg-accent/70 text-foreground",
                              ),
                            ),
                          ],
                          [
                            h.span(
                              [
                                h.Class(
                                  "truncate text-sm font-semibold tracking-tight text-foreground",
                                ),
                              ],
                              [monthName(month.month)],
                            ),
                          ],
                        ),
                      ),
                      headerRow("ruler", LEGEND_HEIGHT, "border-t border-border/50", (month) =>
                        h.keyed("div")(
                          `ruler-${month.month}`,
                          [
                            h.Class(
                              cn(
                                "grid w-[var(--month-col-width)] shrink-0 border-r border-border/80 bg-muted/25 text-[9px] text-muted-foreground",
                                isCurrentMonth(month.month) && "bg-accent/40",
                              ),
                            ),
                            h.Style({
                              "grid-template-columns": templateColumns(
                                visibleYearEventLaneMap(month.segments).laneCount,
                              ),
                            }),
                          ],
                          [
                            h.span(
                              [h.Class("truncate px-1"), h.Style({ "grid-column": "1 / -1" })],
                              ["Events"],
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  h.div(
                    [h.Class("year-grid-top-pad flex min-h-0 min-w-max flex-1 overflow-visible")],
                    [
                      h.div(
                        [h.Class("year-grid-height relative flex min-w-max gap-1")],
                        [
                          h.div(
                            [
                              h.Class(
                                "year-grid-height sticky left-0 z-20 flex w-[var(--day-gutter-width)] flex-shrink-0 flex-col border-r border-border/80 bg-card shadow-[2px_0_8px_rgba(0,0,0,0.08)]",
                              ),
                            ],
                            [
                              h.div(
                                [
                                  h.Class("year-grid-rows grid border-r border-border/80"),
                                  h.Role("presentation"),
                                ],
                                Array.from({ length: DAYS_IN_GRID }, (_, index) => {
                                  const isTodayRow = isCurrentYear && todayDay === index + 1;
                                  return h.div(
                                    [
                                      h.Class(
                                        cn(
                                          "year-grid-text-day relative flex items-center justify-center border-b border-border/80 text-foreground/70",
                                          isTodayRow &&
                                            "font-semibold text-[var(--accent-brand-text)]",
                                        ),
                                      ),
                                      ...(isTodayRow
                                        ? [h.AriaLabel(todayLongLabel(model.today))]
                                        : []),
                                    ],
                                    [
                                      ...(isTodayRow
                                        ? [
                                            h.span(
                                              [
                                                h.Class(
                                                  "pointer-events-none absolute left-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-[var(--accent-brand)]",
                                                ),
                                                h.AriaHidden(true),
                                              ],
                                              [],
                                            ),
                                          ]
                                        : []),
                                      h.span([h.Class("relative z-10")], [String(index + 1)]),
                                    ],
                                  );
                                }),
                              ),
                            ],
                          ),
                          ...spacer(first, "before"),
                          ...visible.map((month) => monthColumn(model, month, h)),
                          ...spacer(11 - last, "after"),
                        ],
                      ),
                    ],
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
};
