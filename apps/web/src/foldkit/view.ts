import type { Document } from "foldkit/html";
import {
  CalendarDays,
  ChartNoAxesGantt,
  ChevronLeft,
  ChevronRight,
  Laptop,
  LayoutGrid,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  Sun,
  X,
} from "lucide";
import { modKeyLabel } from "@/year-view/year-grid-keyboard";
import { nextThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { Message, visibleEvents, type Model } from "./model";
import { act, monthName, type Builder } from "./html";
import { dayDetails, dialogView } from "./dialogs";
import { gridView } from "./grid-view";
import { icon } from "./icons";
import { calendars } from "./sidebar-view";
import { timelineView } from "./timeline-view";
import { buttonClass, inputClass } from "./ui";

const todayLabel = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const TOUR_CAPTIONS = [
  "Open today and browse its events.",
  "Press N to add dinner to the sample calendar.",
  "Open commands to jump to a month or change the view.",
];

const syncBadge = (model: Model) =>
  model.loading
    ? { kind: "syncing", label: "Loading" }
    : model.failures.length > 0
      ? {
          kind: "issues",
          label:
            model.failures.length === 1
              ? `Could not load ${model.failures[0]?.source ?? "one calendar"}`
              : `Could not load ${model.failures.length} calendars`,
        }
      : { kind: "synced", label: "Local" };

const syncBadgeView = (model: Model, h: Builder) => {
  const badge = syncBadge(model);
  return h.span(
    [
      h.Class(
        "inline-flex items-center gap-2 rounded-full border border-border/70 bg-background px-3 py-1.5 text-xs font-medium text-foreground",
      ),
      h.Role("status"),
      h.AriaLive("polite"),
      h.AriaAtomic(true),
    ],
    [
      h.span(
        [
          h.Class(
            cn(
              "size-1.5 rounded-full",
              badge.kind === "issues"
                ? "bg-destructive/70"
                : badge.kind === "syncing"
                  ? "bg-amber-500/80"
                  : "bg-emerald-500/80",
            ),
          ),
          h.AriaHidden(true),
        ],
        [],
      ),
      badge.label,
    ],
  );
};

const logo = (h: Builder) =>
  h.a(
    [
      h.Href("/home"),
      h.AriaLabel("Julian home"),
      h.Class("inline-flex h-10 items-center gap-1.5 rounded-lg px-0.5 text-foreground"),
    ],
    [
      h.span(
        [h.Class("flex h-10 w-10 shrink-0 items-center justify-center rounded-md")],
        [
          h.svg(
            [
              h.AriaHidden(true),
              h.Class("h-7 w-7"),
              h.ViewBox("0 0 24 24"),
              h.Fill("none"),
              h.Stroke("currentColor"),
              h.StrokeWidth("2.4"),
              h.StrokeLinecap("round"),
              h.StrokeLinejoin("round"),
            ],
            [
              h.path([
                h.D(
                  "M2.8 12c2.35-3.9 5.77-6 9.2-6s6.85 2.1 9.2 6c-2.35 3.9-5.77 6-9.2 6s-6.85-2.1-9.2-6Z",
                ),
              ]),
              h.circle([
                h.Attribute("cx", "12"),
                h.Attribute("cy", "12"),
                h.Attribute("r", "3.15"),
                h.Fill("currentColor"),
              ]),
            ],
          ),
        ],
      ),
      h.span(
        [
          h.Class(
            "font-sans text-[18px] leading-none font-semibold tracking-[-0.012em] text-foreground/90",
          ),
        ],
        ["Julian"],
      ),
    ],
  );

const yearNavigator = (model: Model, h: Builder) =>
  h.div(
    [h.Class("flex items-center gap-0.5")],
    [
      h.button(
        [
          h.Type("button"),
          h.Class(buttonClass("ghost", "icon-sm")),
          h.AriaLabel("Previous year"),
          h.OnClick(act("previous-year")),
        ],
        [icon(ChevronLeft)],
      ),
      h.form(
        [
          h.OnSubmit(Message.SubmittedYear()),
          h.Class(
            "flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2 py-2 md:px-3.5",
          ),
        ],
        [
          h.input([
            h.Type("number"),
            h.Name("year"),
            h.AriaLabel("Year"),
            h.InputMode("numeric"),
            h.Min("1970"),
            h.Max("2100"),
            h.Value(model.yearInput),
            h.OnInput((value) => Message.ChangedField({ field: "yearInput", value })),
            h.OnBlur(Message.SubmittedYear()),
            h.Class(
              inputClass(
                "h-7 w-14 border-0 bg-transparent px-0 text-center text-lg font-semibold tabular-nums [appearance:textfield] focus-visible:ring-0 md:w-20 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
              ),
            ),
          ]),
        ],
      ),
      h.button(
        [
          h.Type("button"),
          h.Class(buttonClass("ghost", "icon-sm")),
          h.AriaLabel("Next year"),
          h.OnClick(act("next-year")),
        ],
        [icon(ChevronRight)],
      ),
    ],
  );

const VIEW_MODES = [
  { mode: "grid", label: "Year grid", glyph: LayoutGrid },
  { mode: "timeline", label: "Timeline", glyph: ChartNoAxesGantt },
] as const;

const viewModeToggle = (model: Model, h: Builder) => {
  const other = VIEW_MODES.find((item) => item.mode !== model.mode) ?? VIEW_MODES[1];
  return [
    h.button(
      [
        h.Type("button"),
        h.Class(buttonClass("ghost", "icon-sm", "md:hidden")),
        h.AriaLabel(`Switch to ${other.label.toLowerCase()}`),
        h.AriaKeyshortcuts("V"),
        h.OnClick(Message.ChangedMode({ mode: other.mode })),
      ],
      [icon(other.glyph)],
    ),
    h.div(
      [
        h.Role("group"),
        h.AriaLabel("Layout"),
        h.Class("hidden items-center rounded-lg border border-border/60 bg-muted/30 p-0.5 md:flex"),
      ],
      VIEW_MODES.map(({ mode, label, glyph }) =>
        h.button(
          [
            h.Type("button"),
            h.AriaPressed(String(model.mode === mode)),
            h.AriaLabel(label),
            h.AriaKeyshortcuts("V"),
            h.Title(`${label} (V)`),
            h.OnClick(Message.ChangedMode({ mode })),
            h.Class(
              cn(
                "inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                model.mode === mode && "bg-background text-foreground shadow-sm",
              ),
            ),
          ],
          [icon(glyph), h.span([h.Class("hidden lg:inline")], [label])],
        ),
      ),
    ),
  ];
};

const topBarActions = (model: Model, h: Builder) => [
  h.div([h.Class("hidden h-6 w-px bg-border/70 md:block")], []),
  h.button(
    [
      h.Type("button"),
      h.Class(buttonClass("outline", "sm", "hidden gap-2.5 px-3.5 md:inline-flex")),
      h.AriaLabel(`Go to today, ${todayLabel.format(new Date(`${model.today}T00:00:00`))}`),
      h.OnClick(act("today")),
    ],
    [icon(CalendarDays), "Today"],
  ),
  h.div([h.Class("hidden md:block")], [syncBadgeView(model, h)]),
  ...(model.mode === "grid"
    ? [
        h.select(
          [
            h.Class("h-9 rounded-lg border border-border/60 bg-background px-2 text-xs md:hidden"),
            h.AriaLabel("Jump to month"),
            h.Value(""),
            h.OnChange((value) => Message.SelectedMonth({ month: Number(value) })),
          ],
          [
            h.option([h.Value(""), h.Disabled(true)], ["Month"]),
            ...Array.from({ length: 12 }, (_, month) =>
              h.option([h.Value(String(month))], [monthName(month)]),
            ),
          ],
        ),
      ]
    : []),
  h.button(
    [
      h.Type("button"),
      h.Class(buttonClass("ghost", "sm", "px-2 md:hidden")),
      h.AriaLabel("Open calendars"),
      h.OnClick(act("calendars")),
    ],
    [
      icon(CalendarDays, "size-4 min-[440px]:hidden"),
      h.span([h.Class("hidden min-[440px]:inline")], ["Calendars"]),
    ],
  ),
];

const search = (model: Model, h: Builder) => {
  const count = visibleEvents(model).length;
  return h.div(
    [h.Class("relative flex items-center"), h.Role("search")],
    [
      icon(Search, "pointer-events-none absolute left-2 size-3.5 text-muted-foreground"),
      h.input([
        h.Id("event-search"),
        h.Type("search"),
        h.AriaLabel("Search events"),
        h.AriaKeyshortcuts("/"),
        h.Placeholder(model.width < 768 ? "Search" : "Search  /"),
        h.Value(model.query),
        h.OnInput((value) => Message.ChangedField({ field: "query", value })),
        h.Class(
          "h-8 w-28 rounded-lg border border-border/60 bg-muted/30 pr-7 pl-7 text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none sm:w-40 [&::-webkit-search-cancel-button]:hidden",
        ),
      ]),
      ...(model.query
        ? [
            h.button(
              [
                h.Type("button"),
                h.AriaLabel("Clear search"),
                h.OnClick(act("clear-search")),
                h.Class(
                  "absolute right-1 inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                ),
              ],
              [icon(X, "size-3.5")],
            ),
          ]
        : []),
      h.span(
        [h.AriaLive("polite"), h.Class("sr-only")],
        [model.query.trim() ? `${count} matching ${count === 1 ? "event" : "events"}` : ""],
      ),
    ],
  );
};

const themeToggle = (model: Model, h: Builder) =>
  h.button(
    [
      h.Type("button"),
      h.AriaLabel(`Switch to ${nextThemeMode(model.theme)} theme`),
      h.OnClick(act("theme")),
      h.Class(
        buttonClass(
          "ghost",
          "icon-sm",
          "border border-transparent text-foreground/90 hover:border-border/70",
        ),
      ),
    ],
    [icon(model.theme === "system" ? Laptop : model.theme === "dark" ? Sun : Moon)],
  );

const topBarTrailing = (model: Model, h: Builder) =>
  h.div(
    [h.Class("flex items-center justify-end gap-2 text-foreground/60")],
    [
      h.div([h.Class("md:hidden")], [syncBadgeView(model, h)]),
      h.button(
        [
          h.Type("button"),
          h.AriaHasPopup("dialog"),
          h.AriaExpanded(model.dialog === "commands"),
          h.OnClick(act("commands")),
          h.Class(
            "hidden h-8 min-w-[9.5rem] items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none md:inline-flex",
          ),
        ],
        [
          h.span([h.Class("truncate")], ["Commands"]),
          h.kbd(
            [
              h.Class(
                "ml-auto rounded border border-border/60 bg-background/80 px-1 py-0.5 font-mono text-[10px] leading-none text-muted-foreground",
              ),
            ],
            [`${modKeyLabel(model.platform)}K`],
          ),
        ],
      ),
      h.button(
        [
          h.Type("button"),
          h.AriaPressed(String(model.dialog === "help")),
          h.AriaLabel("Show keyboard shortcuts"),
          h.OnClick(act("help")),
          h.Class(
            "hidden size-8 items-center justify-center rounded-lg border border-border/60 bg-muted/30 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none md:inline-flex",
          ),
        ],
        ["?"],
      ),
      h.button(
        [
          h.Type("button"),
          h.AriaLabel("Appearance settings"),
          h.OnClick(act("settings")),
          h.Class(
            buttonClass(
              "ghost",
              "icon-sm",
              "hidden border border-transparent text-foreground/90 hover:border-border/70 md:inline-flex",
            ),
          ),
        ],
        [icon(Settings2)],
      ),
      themeToggle(model, h),
    ],
  );

const topbar = (model: Model, h: Builder) =>
  h.header(
    [
      h.Class(
        "sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      ),
      h.Style({ "padding-top": "var(--titlebar-height)" }),
    ],
    [
      h.div(
        [
          h.Class(
            "flex w-full flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 md:grid md:h-16 md:grid-cols-[minmax(200px,260px)_1fr_minmax(240px,320px)] md:gap-4 md:px-7 md:py-0",
          ),
        ],
        [
          h.div(
            [h.Class("flex h-10 items-center gap-2")],
            [
              h.button(
                [
                  h.Type("button"),
                  h.Class(
                    buttonClass(
                      "ghost",
                      "icon-sm",
                      "hidden size-8 text-muted-foreground/70 hover:text-foreground md:inline-flex",
                    ),
                  ),
                  h.AriaLabel(model.sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"),
                  h.AriaPressed(String(model.sidebarCollapsed)),
                  h.OnClick(act("sidebar")),
                ],
                [icon(model.sidebarCollapsed ? PanelLeftOpen : PanelLeftClose)],
              ),
              logo(h),
            ],
          ),
          h.div(
            [
              h.Class(
                "order-last flex w-full min-w-0 items-center justify-center gap-2 md:order-none md:w-auto",
              ),
            ],
            [yearNavigator(model, h), ...viewModeToggle(model, h), ...topBarActions(model, h)],
          ),
          h.div(
            [h.Class("ml-auto flex items-center justify-end gap-2 md:ml-0")],
            [search(model, h), topBarTrailing(model, h)],
          ),
        ],
      ),
    ],
  );

const demoBanner = (model: Model, h: Builder) =>
  h.div(
    [
      h.Class(
        "flex flex-wrap items-center gap-2 bg-muted/40 px-2 py-1 text-xs md:justify-center md:gap-x-3 md:gap-y-1 md:border-b md:border-border/40 md:px-6 md:py-2 md:text-center md:text-sm",
      ),
    ],
    [
      h.p(
        [
          h.Class(
            "min-w-40 flex-1 text-xs leading-[14px] text-foreground/80 md:contents md:text-sm md:leading-5 md:text-muted-foreground",
          ),
        ],
        [
          h.span(
            [
              h.Class(
                "font-semibold text-foreground md:rounded md:border md:border-border md:bg-background md:px-2 md:py-0.5 md:text-xs md:tracking-wide md:uppercase",
              ),
            ],
            ["Demo · Sample data"],
          ),
          h.span([h.Class("md:hidden")], [". Changes stay here. "]),
          h.span([h.Class("hidden md:inline")], ["Try it here. Changes stay in this demo."]),
          h.a(
            [h.Href("/home"), h.Class("text-foreground underline underline-offset-2 md:text-xs")],
            ["About Julian"],
          ),
        ],
      ),
      h.button(
        [
          h.Type("button"),
          h.Disabled(model.connecting),
          h.OnClick(act("connect")),
          h.Class(
            "inline-flex h-8 shrink-0 items-center rounded-full bg-foreground px-2 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-60 md:h-7 md:px-3.5",
          ),
        ],
        [model.connecting ? "Connecting…" : "Connect my Google Calendar"],
      ),
    ],
  );

const demoHud = (model: Model, h: Builder) =>
  h.div(
    [
      h.DataAttribute("demo-controls", ""),
      h.Class(
        "flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 pt-0.5 pb-1 text-xs md:py-2",
      ),
    ],
    [
      h.p(
        [
          h.AriaLive("polite"),
          h.Class(cn("min-w-0 text-muted-foreground", !model.tourRunning && "max-md:sr-only")),
        ],
        model.tourRunning
          ? [
              h.span(
                [h.Class("mr-2 font-medium text-foreground")],
                [`Tour ${Math.min(3, Math.max(1, model.tour))}/3`],
              ),
              TOUR_CAPTIONS[Math.min(2, Math.max(0, model.tour - 1))] ?? "",
            ]
          : ["Your turn. Click a day to explore, or add a sample event."],
      ),
      h.div(
        [h.Class("flex min-w-0 flex-wrap items-center gap-1.5 md:shrink-0 md:gap-2")],
        [
          h.button(
            [
              h.Type("button"),
              h.OnClick(act("tour")),
              h.Class(
                "inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 font-medium hover:bg-accent md:h-auto md:py-1.5",
              ),
            ],
            [model.tourRunning ? "Try it now" : "Watch 15s tour"],
          ),
          h.button(
            [
              h.Type("button"),
              h.OnClick(act("create")),
              h.Class(
                "inline-flex h-8 items-center rounded-md bg-foreground px-2.5 font-medium text-background md:h-auto md:py-1.5",
              ),
            ],
            ["Add sample event"],
          ),
          h.button(
            [
              h.Type("button"),
              h.OnClick(act("reset-demo")),
              h.Class(
                "inline-flex h-8 items-center rounded-md px-2 underline underline-offset-2 md:h-auto md:py-1.5",
              ),
            ],
            ["Reset demo"],
          ),
        ],
      ),
    ],
  );

const errorToast = (model: Model, h: Builder) =>
  model.error
    ? [
        h.div(
          [
            h.Role("alert"),
            h.Class(
              "absolute top-4 left-1/2 z-40 flex max-w-[90%] -translate-x-1/2 items-center gap-3 rounded-lg border border-destructive/40 bg-background px-4 py-2 text-sm shadow-lg",
            ),
          ],
          [
            h.span([], [model.error]),
            h.button(
              [
                h.Type("button"),
                h.OnClick(act("refresh")),
                h.Class("text-xs underline underline-offset-2"),
              ],
              ["Retry"],
            ),
            h.button(
              [
                h.Type("button"),
                h.OnClick(act("dismiss-error")),
                h.Class("text-xs underline underline-offset-2"),
              ],
              ["Dismiss"],
            ),
          ],
        ),
      ]
    : [];

const refreshNotice = (model: Model, h: Builder) =>
  model.loading && model.hydrated
    ? [
        h.div(
          [h.Class("pointer-events-none absolute top-4 right-4 z-20")],
          [
            h.div(
              [
                h.Class(
                  "inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/95 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur",
                ),
              ],
              [
                h.span([h.Class("size-2 animate-pulse rounded-full bg-primary/70")], []),
                "Loading events...",
              ],
            ),
          ],
        ),
      ]
    : [];

const calendarScreen = (model: Model, h: Builder) =>
  h.div(
    [h.Class("flex h-[100svh] flex-col overflow-hidden bg-background text-foreground")],
    [
      h.div([h.Class("print:hidden"), h.DataAttribute("app-chrome", "")], [topbar(model, h)]),
      ...(model.page === "demo"
        ? [
            h.div(
              [h.Class("print:hidden"), h.DataAttribute("app-chrome", "")],
              [demoBanner(model, h), demoHud(model, h)],
            ),
          ]
        : []),
      h.div(
        [h.Class("flex min-h-0 flex-1 overflow-hidden")],
        [
          h.aside(
            [
              h.Class(
                cn(
                  "relative hidden shrink-0 flex-col bg-card transition-all duration-200 print:hidden md:flex",
                  model.sidebarCollapsed
                    ? "w-0 border-r border-transparent"
                    : "w-72 border-r border-border/60",
                ),
              ),
              h.AriaLabel("Calendars"),
              ...(model.sidebarCollapsed ? [h.AriaHidden(true), h.Inert(true)] : []),
            ],
            [
              h.div(
                [
                  h.Class(
                    cn(
                      "scrollbar-minimal h-full transition-opacity duration-200",
                      model.sidebarCollapsed
                        ? "pointer-events-none overflow-hidden px-0 py-0 opacity-0"
                        : "overflow-y-auto px-4 py-4",
                    ),
                  ),
                ],
                model.sidebarCollapsed || model.width < 768 ? [] : [calendars(model, h)],
              ),
            ],
          ),
          h.main(
            [
              h.Id("main-content"),
              h.Tabindex(-1),
              ...(model.dialog === "none" ? [] : [h.Inert(true)]),
              h.Class(
                "flex min-h-0 min-w-0 flex-1 flex-col outline-none print:min-h-auto print:overflow-visible",
              ),
            ],
            [
              h.div(
                [h.Class("flex h-full min-h-0 w-full flex-1 flex-col")],
                [
                  h.div(
                    [h.Class("relative h-full")],
                    [
                      ...errorToast(model, h),
                      ...refreshNotice(model, h),
                      ...(model.loading && !model.hydrated
                        ? [
                            h.div(
                              [
                                h.Class(
                                  "flex h-full items-center justify-center text-sm text-muted-foreground",
                                ),
                              ],
                              ["Loading calendar..."],
                            ),
                          ]
                        : [
                            model.mode === "grid" || model.printing
                              ? gridView(model, h)
                              : timelineView(model, h),
                          ]),
                      h.p(
                        [h.Class("sr-only"), h.Role("status"), h.AriaLive("polite")],
                        [model.status],
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

const card = (
  h: Builder,
  eyebrow: string,
  title: string,
  body: readonly ReturnType<Builder["p"]>[],
) =>
  h.main(
    [
      h.Id("main-content"),
      h.Tabindex(-1),
      h.Class(
        "flex min-h-dvh items-center justify-center bg-background px-6 py-10 text-foreground outline-none",
      ),
    ],
    [
      h.section(
        [h.Class("w-full max-w-xl rounded-3xl border border-border/70 bg-card p-8 shadow-sm")],
        [
          h.p(
            [h.Class("text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase")],
            [eyebrow],
          ),
          h.h1([h.Class("mt-3 text-3xl font-semibold tracking-tight")], [title]),
          ...body,
        ],
      ),
    ],
  );

const routeScreen = (model: Model, h: Builder) => {
  if (model.page === "signed-out")
    return card(h, String(model.year), `Connect a calendar to see ${model.year}`, [
      h.p(
        [h.Class("mt-4 text-sm leading-relaxed text-muted-foreground")],
        [
          "Julian reads your Google Calendar in this browser. Connect it, or look around the demo on sample data first.",
        ],
      ),
      h.div(
        [h.Class("mt-8 flex flex-col gap-3 sm:flex-row")],
        [
          h.button(
            [
              h.Type("button"),
              h.Class(buttonClass()),
              h.Disabled(model.connecting),
              h.OnClick(act("connect")),
            ],
            [model.connecting ? "Connecting…" : "Connect Google Calendar"],
          ),
          h.a([h.Href(`/demo/${model.year}`), h.Class(buttonClass("outline"))], ["Open the demo"]),
        ],
      ),
      ...(model.error
        ? [h.p([h.Role("alert"), h.Class("mt-4 text-sm text-destructive")], [model.error])]
        : []),
    ]);
  if (model.page === "not-found")
    return card(h, "Page not found", "This page has already drifted out of view", [
      h.p(
        [h.Class("mt-4 text-sm leading-relaxed text-muted-foreground")],
        [
          "The link may be outdated, or the page may have moved. You can head home or jump straight back into your calendar.",
        ],
      ),
      h.div(
        [h.Class("mt-8 flex flex-col gap-3 sm:flex-row")],
        [
          h.a(
            [h.Href(`/${model.today.slice(0, 4)}`), h.Class(buttonClass())],
            ["Open current year"],
          ),
          h.a([h.Href("/home"), h.Class(buttonClass("outline"))], ["Go home"]),
        ],
      ),
    ]);
  if (model.page === "callback")
    return h.main(
      [
        h.Id("main-content"),
        h.Tabindex(-1),
        h.Class("flex min-h-screen items-center justify-center bg-background outline-none"),
      ],
      [
        h.div(
          [h.Class("text-center")],
          model.error
            ? [
                h.h1([h.Class("mb-4 text-destructive")], ["Authentication failed"]),
                h.p([h.Role("alert"), h.Class("mb-4 text-muted-foreground")], [model.error]),
                h.a([h.Href("/home"), h.Class("text-blue-500 hover:underline")], ["Go home"]),
              ]
            : [
                h.div(
                  [
                    h.Class(
                      "mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-foreground",
                    ),
                  ],
                  [],
                ),
                h.h1([h.Class("text-foreground")], ["Authorizing with Google..."]),
              ],
        ),
      ],
    );
  return h.main(
    [
      h.Id("main-content"),
      h.Tabindex(-1),
      h.Class(
        "flex min-h-dvh items-center justify-center bg-background px-6 text-sm text-muted-foreground outline-none",
      ),
    ],
    [h.h1([], ["Loading calendar..."])],
  );
};

export const view = (model: Model, h: Builder): Document => {
  const calendar = model.page === "calendar" || model.page === "demo";
  return {
    title: `Julian${calendar ? ` · ${model.year}` : ""}`,
    body: h.div(
      [h.Class("julian-root")],
      [
        h.a(
          [
            h.Href("#main-content"),
            h.Class(
              "sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-background focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none",
            ),
          ],
          ["Skip to calendar"],
        ),
        ...(calendar
          ? [
              calendarScreen(model, h),
              dayDetails(model, h),
              dialogView(model, h),
              ...(model.digits
                ? [
                    h.div(
                      [
                        h.AriaHidden(true),
                        h.Class(
                          "pointer-events-none fixed top-1/2 left-1/2 z-40 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border/70 bg-background/95 px-6 py-4 text-4xl font-semibold tabular-nums shadow-lg backdrop-blur",
                        ),
                      ],
                      [model.digits],
                    ),
                  ]
                : []),
            ]
          : [routeScreen(model, h)]),
      ],
    ),
  };
};
