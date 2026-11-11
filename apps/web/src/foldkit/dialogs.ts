import { Option } from "effect";
import { BUILD_INFO, buildLabel } from "@/lib/build-info";
import { formatDateRange } from "@julian/domain";
import { yearGridShortcuts } from "@/components/year-view/year-grid-keyboard";
import { Message, canModify, eventKey, eventsForDate, selectedEvent, type Model } from "./model";
import { act, button, dateLabel, type Builder } from "./html";

export const calendars = (model: Model, h: Builder, drawer = false) =>
  h.div(
    [h.Class("calendar-list"), h.DataAttribute("sidebar-root", "")],
    [
      h.h2([], ["Calendars"]),
      h.button(
        [
          h.Id(drawer ? "drawer-connect" : "sidebar-connect"),
          h.Type("button"),
          h.Class("ui-button connect-button"),
          h.Disabled(model.connecting),
          h.OnClick(act("connect")),
        ],
        [model.connecting ? "Connecting…" : "Connect Google Calendar"],
      ),
      ...(model.page === "calendar" ? [button(h, "Disconnect Google Calendar", "logout")] : []),
      ...(model.loading ? [h.p([], ["Loading calendars..."])] : []),
      ...model.calendars.map((calendar) =>
        h.label(
          [h.Class("calendar-toggle")],
          [
            h.input([
              h.Type("checkbox"),
              h.Checked(model.selectedCalendarIds.includes(calendar.id)),
              h.OnChange(() => Message.ClickedCalendar({ id: calendar.id })),
            ]),
            h.span(
              [
                h.Class("calendar-dot"),
                h.Style({ background: calendar.backgroundColor ?? "#555" }),
                h.AriaHidden(true),
              ],
              [],
            ),
            calendar.summary,
          ],
        ),
      ),
      ...(model.failures.length
        ? [
            h.div(
              [h.Role("status"), h.Class("sync-failures")],
              [
                h.p([], ["Some calendars could not be loaded:"]),
                ...model.failures.map((failure) =>
                  h.p([], [`${failure.source}: ${failure.message}`]),
                ),
                button(h, "Retry", "refresh"),
              ],
            ),
          ]
        : []),
    ],
  );

export const dayDetails = (model: Model, h: Builder) => {
  if (
    !model.details ||
    model.dialog !== "none" ||
    (model.page !== "calendar" && model.page !== "demo")
  )
    return h.span([], []);
  const events = eventsForDate(model);
  const selected = selectedEvent(model);
  return h.aside(
    [h.AriaLabel("Event details"), h.Class("day-details"), h.Id("day-details")],
    [
      h.div(
        [
          h.Role("dialog"),
          h.AriaLabel(`${dateLabel(model.date)} events`),
          h.Class("day-details-content"),
        ],
        [
          h.h2([], [`${dateLabel(model.date)} events`]),
          h.div(
            [h.Role("listbox"), h.AriaLabel("Events on this day")],
            events.map((event) =>
              h.div(
                [
                  h.Role("option"),
                  h.Tabindex(-1),
                  h.AriaSelected(model.selectedKey === eventKey(event)),
                  h.Class("event-option"),
                  h.OnClick(Message.SelectedEvent({ key: eventKey(event) })),
                ],
                [
                  h.strong([], [event.title]),
                  h.span([], [`${event.calendarSummary ?? ""} · ${formatDateRange(event)}`]),
                ],
              ),
            ),
          ),
          ...(events.length === 0 ? [h.p([], ["No events on this day."])] : []),
          ...(selected
            ? [
                h.h3([], [selected.title]),
                h.p([h.Id("event-dates")], [formatDateRange(selected)]),
                ...(selected.description
                  ? [h.p([h.Class("event-description")], [selected.description])]
                  : []),
                ...(canModify(model, selected)
                  ? [
                      ...(selected.allDay ? [button(h, "Move to another day", "move")] : []),
                      button(h, "Edit event", "edit"),
                      button(h, "Delete event", "delete"),
                    ]
                  : [h.p([], ["This event is read-only."])]),
                button(h, "Open in Google Calendar", "open-event"),
              ]
            : []),
          button(h, "New event", "create"),
          h.button(
            [
              h.Type("button"),
              h.Class("ui-button"),
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
            ],
            ["Close day details"],
          ),
        ],
      ),
    ],
  );
};

const commandChoices = [
  { name: "Go to today", action: "today" },
  { name: "New event", action: "create" },
  { name: "Refresh events", action: "refresh" },
  { name: "Show keyboard shortcuts", action: "help" },
  { name: "Toggle sidebar", action: "sidebar" },
  { name: "Appearance settings", action: "settings" },
] as const;

export const dialogView = (model: Model, h: Builder) => {
  const event = selectedEvent(model);
  const label =
    model.dialog === "create"
      ? "New event"
      : model.dialog === "edit"
        ? "Edit event"
        : model.dialog === "move"
          ? "Move event"
          : model.dialog === "delete"
            ? "Delete event?"
            : model.dialog === "help"
              ? "Keyboard shortcuts"
              : model.dialog === "commands"
                ? "Commands"
                : model.dialog === "calendars"
                  ? "Calendars"
                  : "Appearance";
  const matches = commandChoices.filter((choice) =>
    choice.name.toLowerCase().includes(model.commandQuery.toLowerCase()),
  );
  return h.dialog(
    [
      h.Id("app-dialog"),
      h.AriaLabel(label),
      h.Class(`app-dialog ${model.dialog === "calendars" ? "calendars-dialog" : ""}`),
      h.Tabindex(-1),
      h.OnCancel(act("close-dialog")),
      ...(model.dialog === "calendars" ? [h.DataAttribute("mobile-sidebar", "")] : []),
    ],
    model.dialog === "none"
      ? []
      : [
          h.button(
            [
              h.Type("button"),
              h.Tabindex(-1),
              h.AriaLabel(model.dialog === "calendars" ? "Close sidebar" : "Close dialog backdrop"),
              h.Class("dialog-backdrop"),
              h.OnClick(act("close-dialog")),
            ],
            [],
          ),
          h.section(
            [h.Class("dialog-panel"), h.DataAttribute("slot", "dialog-content")],
            model.dialog === "calendars"
              ? [calendars(model, h, true)]
              : [
                  h.h2([], [label]),
                  ...(model.dialog === "create" || model.dialog === "edit"
                    ? [
                        h.form(
                          [h.OnSubmit(act("submit"))],
                          [
                            h.p(
                              [],
                              [
                                model.dialog === "create"
                                  ? `${dateLabel(model.date)}, ${model.year}`
                                  : event
                                    ? formatDateRange(event)
                                    : "",
                              ],
                            ),
                            h.label([h.For("event-title")], ["Event title"]),
                            h.input([
                              h.Id("event-title"),
                              h.Type("text"),
                              h.Value(model.titleInput),
                              h.Required(true),
                              h.OnInput((value) =>
                                Message.ChangedField({ field: "titleInput", value }),
                              ),
                            ]),
                            h.button(
                              [
                                h.Type("submit"),
                                h.Disabled(model.busy),
                                h.Class("ui-button primary"),
                              ],
                              [
                                model.busy
                                  ? "Saving…"
                                  : model.dialog === "create"
                                    ? "Add event"
                                    : "Save",
                              ],
                            ),
                            h.button(
                              [
                                h.Type("button"),
                                h.Disabled(model.busy),
                                h.Class("ui-button"),
                                h.OnClick(act("close-dialog")),
                              ],
                              ["Cancel"],
                            ),
                          ],
                        ),
                      ]
                    : []),
                  ...(model.dialog === "move"
                    ? [
                        h.form(
                          [h.OnSubmit(act("submit"))],
                          [
                            h.p([], [event?.title ?? ""]),
                            h.label([h.For("move-date")], ["Start date"]),
                            h.input([
                              h.Id("move-date"),
                              h.Type("date"),
                              h.Required(true),
                              h.Value(model.moveDate),
                              h.OnInput((value) =>
                                Message.ChangedField({ field: "moveDate", value }),
                              ),
                            ]),
                            h.button([h.Type("submit"), h.Class("ui-button primary")], ["Move"]),
                            button(h, "Cancel", "close-dialog"),
                          ],
                        ),
                      ]
                    : []),
                  ...(model.dialog === "delete"
                    ? [
                        h.p([], [`Delete ${event?.title ?? "this event"}? This cannot be undone.`]),
                        h.button(
                          [
                            h.Id("confirm-delete"),
                            h.Type("button"),
                            h.Disabled(model.busy),
                            h.Class("ui-button danger"),
                            h.OnClick(act("submit")),
                          ],
                          [model.busy ? "Deleting…" : "Delete"],
                        ),
                        button(h, "Cancel", "close-dialog"),
                      ]
                    : []),
                  ...(model.dialog === "help"
                    ? [
                        h.dl(
                          [],
                          yearGridShortcuts(model.platform).map((shortcut) =>
                            h.div(
                              [h.Class("shortcut-row")],
                              [h.dt([], [shortcut.keys]), h.dd([], [shortcut.action])],
                            ),
                          ),
                        ),
                      ]
                    : []),
                  ...(model.dialog === "commands"
                    ? [
                        h.input([
                          h.Id("command-search"),
                          h.Role("combobox"),
                          h.AriaLabel("Search commands"),
                          h.AriaExpanded(true),
                          h.AriaControls("command-list"),
                          h.Value(model.commandQuery),
                          h.OnInput((value) =>
                            Message.ChangedField({ field: "commandQuery", value }),
                          ),
                          h.OnKeyDownPreventDefault((key) =>
                            key === "Enter" && matches[0]
                              ? Option.some(act(matches[0].action))
                              : Option.none(),
                          ),
                        ]),
                        h.div(
                          [h.Id("command-list"), h.Role("listbox"), h.AriaLabel("Commands")],
                          matches.map((choice) =>
                            h.button(
                              [
                                h.Type("button"),
                                h.Role("option"),
                                h.AriaSelected(false),
                                h.OnClick(act(choice.action)),
                              ],
                              [choice.name],
                            ),
                          ),
                        ),
                      ]
                    : []),
                  ...(model.dialog === "settings"
                    ? [
                        h.p([], [`Julian ${buildLabel(BUILD_INFO)}`]),
                        h.label([h.For("font-size")], ["Font size"]),
                        h.select(
                          [
                            h.Id("font-size"),
                            h.Value(model.fontSize),
                            h.OnChange((value) =>
                              Message.ChangedSetting({ field: "fontSize", value }),
                            ),
                          ],
                          ["small", "medium", "large"].map((value) =>
                            h.option([h.Value(value)], [value]),
                          ),
                        ),
                        h.label([h.For("density")], ["Density"]),
                        h.select(
                          [
                            h.Id("density"),
                            h.Value(model.density),
                            h.OnChange((value) =>
                              Message.ChangedSetting({ field: "density", value }),
                            ),
                          ],
                          ["comfortable", "compact"].map((value) =>
                            h.option([h.Value(value)], [value]),
                          ),
                        ),
                        button(
                          h,
                          `Switch to ${model.theme === "system" ? "light" : model.theme === "light" ? "dark" : "system"} theme`,
                          "theme",
                        ),
                      ]
                    : []),
                  ...(model.dialogError
                    ? [h.p([h.Role("alert"), h.Class("error")], [model.dialogError])]
                    : []),
                  h.button(
                    [
                      h.Id("dialog-close"),
                      h.Type("button"),
                      h.Class("ui-button dialog-close"),
                      h.OnClick(act("close-dialog")),
                    ],
                    ["Close"],
                  ),
                ],
          ),
        ],
  );
};
