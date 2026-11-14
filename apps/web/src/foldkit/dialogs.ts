import { Effect, Option, Schema } from "effect";
import { autoUpdate, computePosition, flip, offset, shift } from "@floating-ui/dom";
import * as Mount from "foldkit/mount";
import { cellDomId } from "@/year-view/year-grid-keyboard";
import { BUILD_INFO, buildLabel } from "@/lib/build-info";
import {
  DISPLAY_TIME_ZONE,
  formatDateRange,
  formatTimeRange,
  getDefaultWritableCalendar,
} from "@julian/domain";
import { Search as SearchIcon, X } from "lucide";
import { cn } from "@/lib/utils";
import { icon } from "./icons";
import { buttonClass, inputClass } from "./ui";
import { nextThemeMode } from "@/lib/theme";
import { yearGridShortcuts } from "@/year-view/year-grid-keyboard";
import {
  Message,
  canModify,
  eventKey,
  eventsForDate,
  selectedEvent,
  type Event,
  type Model,
} from "./model";
import { act, dateLabel, type Builder } from "./html";
import { calendars } from "./sidebar-view";
import { commandMatches } from "./command-palette";

const linkButton = (h: Builder, label: string, action: Parameters<typeof act>[0], extra = "") =>
  h.button(
    [
      h.Type("button"),
      h.Class(cn("block text-xs underline underline-offset-2", extra)),
      h.OnClick(act(action)),
    ],
    [label],
  );

const colorSquare = (event: Event, h: Builder, extra = "") => {
  const color = event.calendarColor ?? "#8b8b8b";
  return h.span(
    [
      h.Class(cn("size-2.5 shrink-0 rounded-[3px] border-2", extra)),
      h.Style({ "border-color": color, "background-color": event.allDay ? color : "transparent" }),
      h.AriaHidden(true),
    ],
    [],
  );
};

const eventDetail = (model: Model, event: Event | undefined, h: Builder) => {
  if (!event)
    return h.aside(
      [
        h.AriaLabel("Event details"),
        h.Class(
          "flex min-h-40 w-72 items-center justify-center border-l border-border/80 px-3 py-2",
        ),
      ],
      [
        h.div(
          [h.Class("flex flex-col items-center gap-2")],
          [
            h.p([h.Class("text-sm text-muted-foreground")], ["No events on this day"]),
            linkButton(h, "New event", "create"),
          ],
        ),
      ],
    );
  const calendar = model.calendars.find((entry) => entry.id === event.calendarId);
  const writable = canModify(model, event);
  return h.aside(
    [h.AriaLabel("Event details"), h.Class("min-h-40 w-72 border-l border-border/80 px-3 py-2")],
    [
      h.div(
        [h.Class("flex items-start gap-2 pr-6")],
        [
          colorSquare(event, h, "mt-1"),
          h.div(
            [h.Class("min-w-0")],
            [
              h.p(
                [h.Class("line-clamp-3 text-sm leading-snug font-medium text-foreground")],
                [event.title],
              ),
              h.p([h.Class("mt-1 text-[11px] text-muted-foreground")], [formatTimeRange(event)]),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class("mt-3 space-y-1.5 text-[11px] text-muted-foreground")],
        [
          h.p([h.Id("event-dates"), h.Class("truncate")], [formatDateRange(event)]),
          h.p([h.Class("truncate")], [calendar?.summary ?? event.calendarSummary ?? "Calendar"]),
          h.p([], [event.allDay ? "All-day event" : "Timed event"]),
          ...(event.allDay ? [] : [h.p([], [`Times in ${DISPLAY_TIME_ZONE}`])]),
          ...(writable ? [] : [h.p([], ["This event is read-only."])]),
        ],
      ),
      h.div(
        [h.Class("mt-3 flex flex-col items-start gap-2")],
        [
          ...(writable && event.allDay ? [linkButton(h, "Move to another day", "move")] : []),
          ...(writable
            ? [linkButton(h, "Edit event", "edit"), linkButton(h, "Delete event", "delete")]
            : []),
          ...(event.htmlLink || event.calendarId === "__google_tasks__"
            ? [linkButton(h, "Open in Google Calendar", "open-event")]
            : []),
          linkButton(h, "New event", "create"),
        ],
      ),
      ...(event.description
        ? [
            h.p(
              [
                h.Class(
                  "event-description mt-3 line-clamp-4 text-[11px] leading-relaxed text-muted-foreground",
                ),
              ],
              [event.description],
            ),
          ]
        : []),
    ],
  );
};

export const placeDayPanel = (cell: Element, element: HTMLElement) =>
  computePosition(cell, element, {
    strategy: "fixed",
    placement: "right-start",
    middleware: [
      offset(6),
      flip({ padding: 8, crossAxis: false }),
      shift({ padding: 8, crossAxis: true }),
    ],
  }).then(({ x, y }) => {
    element.style.setProperty("left", `${x}px`);
    element.style.setProperty("top", `${y}px`);
    element.style.setProperty("visibility", "visible");
  });

// Beside the selected day like the React app's panel: to its right, or its
// left when the right has no room, sliding over the grid when neither fits.
const AnchorDayPanel = Mount.define("AnchorDayPanel", {
  args: { cellId: Schema.String },
  messages: [Message.Completed],
  execute: ({ element, cellId }) =>
    Effect.gen(function* () {
      yield* Effect.acquireRelease(
        Effect.sync(() => {
          const cell = document.getElementById(cellId);
          if (!cell || !(element instanceof HTMLElement)) return () => undefined;
          return autoUpdate(cell, element, () => void placeDayPanel(cell, element));
        }),
        (cleanup) => Effect.sync(cleanup),
      );
      return Message.Completed();
    }),
});

export const dayDetails = (model: Model, h: Builder) => {
  if (
    !model.details ||
    model.dialog !== "none" ||
    (model.page !== "calendar" && model.page !== "demo")
  )
    return h.span([], []);
  const events = eventsForDate(model);
  const selected = selectedEvent(model) ?? events[0];
  const activeKey = selected ? eventKey(selected) : undefined;
  const label = dateLabel(model.date);
  // Phones have no room beside the day, so the panel sits at the bottom.
  const anchored = model.mode === "grid" && model.width >= 640;
  return h.keyed("div")(
    `day-panel-${model.mode}-${model.date}`,
    [
      h.Id("day-details"),
      h.Role("dialog"),
      h.AriaModal(true),
      h.AriaLabel(`${label} events`),
      h.Class(
        cn(
          "z-50 flex max-h-[min(60vh,480px)] max-w-[calc(100vw-16px)] overflow-auto rounded-[12px] border border-border bg-popover text-popover-foreground shadow-lg outline-none max-sm:flex-col print:hidden",
          anchored
            ? ""
            : model.width < 640
              ? "fixed inset-x-2 bottom-2"
              : "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
        ),
      ),
      ...(anchored
        ? [
            h.Style({ position: "fixed", left: "0", top: "0", visibility: "hidden" }),
            h.OnMount(
              AnchorDayPanel({
                cellId: cellDomId(
                  model.year,
                  Number(model.date.slice(5, 7)) - 1,
                  Number(model.date.slice(8, 10)),
                ),
              }),
            ),
          ]
        : []),
    ],
    [
      h.div(
        [h.Class("w-64 overflow-y-auto p-2")],
        [
          h.p([h.Class("px-1.5 pb-1.5 text-[11px] font-medium text-muted-foreground")], [label]),
          ...(events.length === 0
            ? [h.p([h.Class("px-1.5 text-[12px] text-muted-foreground")], ["No events"])]
            : [
                h.ul(
                  [
                    h.Class("space-y-0.5"),
                    h.Role("listbox"),
                    h.Tabindex(-1),
                    h.AriaLabel(`Events for ${label}`),
                    ...(activeKey ? [h.AriaActiveDescendant(`day-panel-event-${activeKey}`)] : []),
                  ],
                  events.map((event) => {
                    const key = eventKey(event);
                    const active = key === activeKey;
                    return h.keyed("li")(
                      key,
                      [h.Role("presentation")],
                      [
                        h.button(
                          [
                            h.Type("button"),
                            h.Id(`day-panel-event-${key}`),
                            h.Tabindex(-1),
                            h.Role("option"),
                            h.AriaSelected(active),
                            h.OnClick(Message.SelectedEvent({ key })),
                            h.Class(
                              cn(
                                "flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
                                active ? "bg-muted" : "hover:bg-muted/60",
                              ),
                            ),
                          ],
                          [
                            colorSquare(event, h),
                            h.span(
                              [h.Class("min-w-0 flex-1 truncate text-[12px] text-foreground")],
                              [event.title],
                            ),
                            h.span(
                              [
                                h.Class(
                                  cn(
                                    "shrink-0 text-[10px]",
                                    active ? "text-foreground/80" : "text-muted-foreground",
                                  ),
                                ),
                              ],
                              [formatTimeRange(event)],
                            ),
                          ],
                        ),
                      ],
                    );
                  }),
                ),
              ]),
        ],
      ),
      eventDetail(model, selected, h),
      h.button(
        [
          h.Type("button"),
          h.AriaLabel("Close day details"),
          h.OnClick(
            Message.PressedKey({
              key: "Escape",
              code: "Escape",
              shift: false,
              alt: false,
              mod: false,
              area: "grid",
            }),
          ),
          h.Class(
            "absolute top-1.5 right-1.5 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
          ),
        ],
        [icon(X, "size-3.5")],
      ),
    ],
  );
};

const dialogTitle = (h: Builder, text: string, extra = "") =>
  h.h2([h.Class(cn("text-lg leading-none font-semibold", extra))], [text]);

const dialogDescription = (h: Builder, text: string) =>
  h.p([h.Class("text-sm text-muted-foreground")], [text]);

const dialogHeader = (h: Builder, title: string, description?: string) =>
  h.div(
    [h.Class("flex flex-col gap-2 text-center sm:text-left")],
    [dialogTitle(h, title), ...(description ? [dialogDescription(h, description)] : [])],
  );

const dialogFooter = (h: Builder, children: readonly ReturnType<Builder["button"]>[]) =>
  h.div([h.Class("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end")], [...children]);

const cancelButton = (model: Model, h: Builder) =>
  h.button(
    [
      h.Type("button"),
      h.Disabled(model.busy),
      h.Class(buttonClass("outline")),
      h.OnClick(act("close-dialog")),
    ],
    ["Cancel"],
  );

const errorLine = (model: Model, h: Builder) =>
  model.dialogError
    ? [h.p([h.Role("alert"), h.Class("text-sm text-destructive")], [model.dialogError])]
    : [];

const eventForm = (model: Model, h: Builder) => {
  const event = selectedEvent(model);
  const create = model.dialog === "create";
  const target = create ? null : event;
  const calendarName = create
    ? (getDefaultWritableCalendar(model.calendars)?.summary ?? null)
    : (target?.calendarSummary ?? null);
  const dateText = create
    ? `${dateLabel(model.date)}, ${model.year}`
    : target
      ? formatDateRange(target)
      : "";
  return h.form(
    [h.OnSubmit(act("submit"))],
    [
      dialogHeader(
        h,
        create ? "New event" : "Edit event",
        `${dateText}${calendarName ? ` · ${calendarName}` : ""}`,
      ),
      h.div(
        [h.Class("mt-4")],
        [
          h.input([
            h.Id("event-title"),
            h.Type("text"),
            h.AriaLabel("Event title"),
            h.Placeholder("Event title"),
            h.Value(model.titleInput),
            h.Required(true),
            h.Disabled(model.busy),
            h.Class(inputClass()),
            h.OnInput((value) => Message.ChangedField({ field: "titleInput", value })),
          ]),
          ...(create && calendarName === null
            ? [
                h.p(
                  [h.Class("mt-2 text-sm text-muted-foreground")],
                  ["Connect a writable Google calendar to create events."],
                ),
              ]
            : []),
          ...errorLine(model, h).map((line) => h.div([h.Class("mt-2")], [line])),
        ],
      ),
      h.div(
        [h.Class("mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end")],
        [
          cancelButton(model, h),
          h.button(
            [
              h.Type("submit"),
              h.Disabled(model.busy || model.titleInput.trim() === ""),
              h.Class(buttonClass()),
            ],
            [model.busy ? (create ? "Adding…" : "Saving…") : create ? "Add event" : "Save"],
          ),
        ],
      ),
    ],
  );
};

const moveForm = (model: Model, h: Builder) => {
  const event = selectedEvent(model);
  return h.form(
    [h.OnSubmit(act("submit")), h.Class("grid gap-4")],
    [
      dialogHeader(
        h,
        "Move event",
        `Pick the day “${event?.title ?? ""}” should start on. Its length stays the same.`,
      ),
      h.label(
        [h.For("move-date"), h.Class("grid gap-1.5 text-sm font-medium")],
        [
          "Start date",
          h.input([
            h.Id("move-date"),
            h.Type("date"),
            h.Required(true),
            h.Value(model.moveDate),
            h.Class(inputClass()),
            h.OnInput((value) => Message.ChangedField({ field: "moveDate", value })),
          ]),
        ],
      ),
      ...errorLine(model, h),
      dialogFooter(h, [
        cancelButton(model, h),
        h.button(
          [
            h.Type("submit"),
            h.Disabled(!/^\d{4}-\d{2}-\d{2}$/.test(model.moveDate)),
            h.Class(buttonClass()),
          ],
          ["Move"],
        ),
      ]),
    ],
  );
};

const deleteBody = (model: Model, h: Builder) => {
  const event = selectedEvent(model);
  return [
    dialogHeader(
      h,
      "Delete event?",
      `“${event?.title ?? "This event"}” will be permanently removed from Google Calendar.`,
    ),
    ...errorLine(model, h),
    dialogFooter(h, [
      cancelButton(model, h),
      h.button(
        [
          h.Id("confirm-delete"),
          h.Type("button"),
          h.Disabled(model.busy),
          h.Class(buttonClass("destructive")),
          h.OnClick(act("submit")),
        ],
        [model.busy ? "Deleting…" : "Delete"],
      ),
    ]),
  ];
};

const helpBody = (model: Model, h: Builder) => [
  dialogHeader(h, "Keyboard shortcuts"),
  h.dl(
    [h.Class("grid max-h-[min(60vh,28rem)] gap-x-6 gap-y-2 overflow-y-auto sm:grid-cols-2")],
    yearGridShortcuts(model.platform).map((shortcut) =>
      h.div(
        [h.Class("flex items-start justify-between gap-3 text-sm")],
        [
          h.dt([h.Class("shrink-0 font-mono text-xs text-muted-foreground")], [shortcut.keys]),
          h.dd([h.Class("text-right text-foreground")], [shortcut.action]),
        ],
      ),
    ),
  ),
];

const commandsBody = (model: Model, h: Builder) => {
  const matches = commandMatches(model);
  return [
    h.h2([h.Class("sr-only")], ["Commands"]),
    h.p([h.Class("sr-only")], ["Search for a command to run"]),
    h.div(
      [
        h.Class(
          "flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground",
        ),
      ],
      [
        h.div(
          [h.Class("flex h-12 items-center gap-2 border-b px-3")],
          [
            icon(SearchIcon, "size-5 shrink-0 opacity-50"),
            h.input([
              h.Id("command-search"),
              h.Role("combobox"),
              h.AriaLabel("Search commands"),
              h.AriaExpanded(true),
              h.AriaControls("command-list"),
              h.AriaAutocomplete("list"),
              ...(matches[0] ? [h.AriaActiveDescendant("command-option-0")] : []),
              h.Placeholder("Search commands…"),
              h.Value(model.commandQuery),
              h.Class(
                "flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground",
              ),
              h.OnInput((value) => Message.ChangedField({ field: "commandQuery", value })),
              h.OnKeyDownPreventDefault((key) =>
                key === "Enter" ? Option.some(Message.SubmittedCommand()) : Option.none(),
              ),
            ]),
          ],
        ),
        h.div(
          [h.Class("max-h-[300px] scroll-py-1 overflow-x-hidden overflow-y-auto")],
          matches.length === 0
            ? [h.p([h.Class("py-6 text-center text-sm")], ["No matching commands."])]
            : [
                h.div(
                  [h.Class("overflow-hidden p-1 px-2 text-foreground")],
                  [
                    h.p(
                      [h.Class("px-2 py-1.5 text-xs font-medium text-muted-foreground")],
                      ["Actions"],
                    ),
                    h.div(
                      [h.Id("command-list"), h.Role("listbox"), h.AriaLabel("Commands")],
                      matches.map((choice, index) =>
                        h.button(
                          [
                            h.Type("button"),
                            h.Id(`command-option-${index}`),
                            h.Role("option"),
                            h.Tabindex(-1),
                            h.AriaSelected(index === 0),
                            h.OnClick(act(choice.action)),
                            h.Class(
                              cn(
                                "relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-3 text-left text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground",
                                index === 0 && "bg-accent text-accent-foreground",
                              ),
                            ),
                          ],
                          [
                            h.span([], [choice.name]),
                            ...(choice.hint
                              ? [
                                  h.span(
                                    [
                                      h.Class(
                                        "ml-auto text-xs tracking-widest text-muted-foreground",
                                      ),
                                    ],
                                    [choice.hint],
                                  ),
                                ]
                              : []),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ],
        ),
      ],
    ),
  ];
};

const settingsSelect = (
  h: Builder,
  id: string,
  label: string,
  value: string,
  options: readonly string[],
  field: "fontSize" | "density",
) =>
  h.label(
    [h.For(id), h.Class("grid gap-1.5 text-sm font-medium")],
    [
      label,
      h.select(
        [
          h.Id(id),
          h.Value(value),
          h.Class(inputClass("capitalize")),
          h.OnChange((next) => Message.ChangedSetting({ field, value: next })),
        ],
        options.map((option) => h.option([h.Value(option)], [option])),
      ),
    ],
  );

const settingsBody = (model: Model, h: Builder) => [
  dialogHeader(h, "Appearance", `Julian ${buildLabel(BUILD_INFO)}`),
  h.div(
    [h.Class("grid gap-4")],
    [
      settingsSelect(
        h,
        "font-size",
        "Font size",
        model.fontSize,
        ["small", "medium", "large"],
        "fontSize",
      ),
      settingsSelect(h, "density", "Density", model.density, ["comfortable", "compact"], "density"),
    ],
  ),
  dialogFooter(h, [
    h.button(
      [h.Type("button"), h.Class(buttonClass("outline")), h.OnClick(act("theme"))],
      [`Switch to ${nextThemeMode(model.theme)} theme`],
    ),
  ]),
];

const dialogLabel = (dialog: Model["dialog"]) =>
  dialog === "create"
    ? "New event"
    : dialog === "edit"
      ? "Edit event"
      : dialog === "move"
        ? "Move event"
        : dialog === "delete"
          ? "Delete event?"
          : dialog === "help"
            ? "Keyboard shortcuts"
            : dialog === "commands"
              ? "Commands"
              : dialog === "calendars"
                ? "Calendars"
                : "Appearance";

const panelWidth = (dialog: Model["dialog"]) =>
  dialog === "help"
    ? "sm:max-w-2xl"
    : dialog === "move"
      ? "sm:max-w-sm"
      : dialog === "commands"
        ? "overflow-hidden p-0 sm:max-w-lg"
        : "sm:max-w-md";

export const dialogView = (model: Model, h: Builder) => {
  const drawer = model.dialog === "calendars";
  return h.dialog(
    [
      h.Id("app-dialog"),
      h.AriaLabel(dialogLabel(model.dialog)),
      h.Tabindex(-1),
      h.OnCancel(act("close-dialog")),
      h.Class(
        "m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden bg-transparent p-0 text-foreground backdrop:bg-transparent",
      ),
      ...(drawer ? [h.DataAttribute("mobile-sidebar", "")] : []),
    ],
    model.dialog === "none"
      ? []
      : [
          h.button(
            [
              h.Type("button"),
              h.Tabindex(-1),
              h.AriaLabel(drawer ? "Close sidebar" : "Close dialog backdrop"),
              h.Class(
                cn("fixed inset-0 z-50 animate-in bg-black/50 fade-in-0", drawer && "bg-black/40"),
              ),
              h.OnClick(act("close-dialog")),
            ],
            [],
          ),
          drawer
            ? h.section(
                [
                  h.DataAttribute("slot", "dialog-content"),
                  h.Class(
                    "fixed inset-y-0 left-0 z-50 h-full w-72 overflow-y-auto border-r border-border/60 bg-card px-4 py-4 shadow-xl scrollbar-minimal",
                  ),
                ],
                [calendars(model, h, true)],
              )
            : h.section(
                [
                  h.DataAttribute("slot", "dialog-content"),
                  h.Class(
                    cn(
                      "fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] animate-in gap-4 rounded-lg border bg-background p-6 shadow-lg duration-200 outline-none fade-in-0 zoom-in-95",
                      panelWidth(model.dialog),
                    ),
                  ),
                ],
                [
                  ...(model.dialog === "create" || model.dialog === "edit"
                    ? [eventForm(model, h)]
                    : model.dialog === "move"
                      ? [moveForm(model, h)]
                      : model.dialog === "delete"
                        ? deleteBody(model, h)
                        : model.dialog === "help"
                          ? helpBody(model, h)
                          : model.dialog === "commands"
                            ? commandsBody(model, h)
                            : settingsBody(model, h)),
                  h.button(
                    [
                      h.Id("dialog-close"),
                      h.Type("button"),
                      h.OnClick(act("close-dialog")),
                      h.Class(
                        cn(
                          "absolute top-4 right-4 rounded-xs opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden",
                          model.dialog === "commands" && "top-3.5",
                        ),
                      ),
                    ],
                    [icon(X, "size-4"), h.span([h.Class("sr-only")], ["Close"])],
                  ),
                ],
              ),
        ],
  );
};
