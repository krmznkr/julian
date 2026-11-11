import type { Document } from "foldkit/html";
import { modKeyLabel } from "@/components/year-view/year-grid-keyboard";
import { nextThemeMode } from "@/lib/theme";
import { Message, visibleEvents, type Model } from "./model";
import { act, button, type Builder } from "./html";
import { calendars, dayDetails, dialogView } from "./dialogs";
import { gridView } from "./grid-view";
import { timelineView } from "./timeline-view";

const topbar = (model: Model, h: Builder) =>
  h.header(
    [h.Class("app-topbar"), h.DataAttribute("app-chrome", "")],
    [
      h.a([h.Href("/home"), h.Class("brand")], ["Julian"]),
      h.button(
        [
          h.Type("button"),
          h.Class("ui-button sidebar-toggle"),
          h.AriaLabel(
            model.width < 768
              ? "Open calendars"
              : model.sidebarCollapsed
                ? "Expand sidebar"
                : "Collapse sidebar",
          ),
          h.OnClick(act(model.width < 768 ? "calendars" : "sidebar")),
        ],
        ["☰"],
      ),
      h.button(
        [
          h.Type("button"),
          h.Class("ui-button"),
          h.AriaLabel("Previous year"),
          h.OnClick(act("previous-year")),
        ],
        ["‹"],
      ),
      h.form(
        [h.OnSubmit(Message.SubmittedYear()), h.Class("year-form")],
        [
          h.input([
            h.Type("number"),
            h.AriaLabel("Year"),
            h.Min("1970"),
            h.Max("2100"),
            h.Value(model.yearInput),
            h.OnInput((value) => Message.ChangedField({ field: "yearInput", value })),
            h.OnBlur(Message.SubmittedYear()),
          ]),
        ],
      ),
      h.button(
        [
          h.Type("button"),
          h.Class("ui-button"),
          h.AriaLabel("Next year"),
          h.OnClick(act("next-year")),
        ],
        ["›"],
      ),
      h.button(
        [
          h.Type("button"),
          h.Class("ui-button today-button"),
          h.AriaLabel("Go to today"),
          h.OnClick(act("today")),
        ],
        ["Today"],
      ),
      h.div(
        [h.Class("search-field")],
        [
          h.input([
            h.Id("event-search"),
            h.Type("search"),
            h.AriaLabel("Search events"),
            h.Placeholder(model.width < 768 ? "Search" : "Search  /"),
            h.Value(model.query),
            h.OnInput((value) => Message.ChangedField({ field: "query", value })),
          ]),
          ...(model.query
            ? [
                h.button(
                  [
                    h.Type("button"),
                    h.Class("ui-button"),
                    h.AriaLabel("Clear search"),
                    h.OnClick(act("clear-search")),
                  ],
                  ["×"],
                ),
              ]
            : []),
        ],
      ),
      ...(model.width >= 768
        ? [
            h.div(
              [h.Role("group"), h.AriaLabel("Layout"), h.Class("layout-switch")],
              [
                h.button(
                  [
                    h.Type("button"),
                    h.AriaPressed(String(model.mode === "grid")),
                    h.OnClick(Message.ChangedMode({ mode: "grid" })),
                  ],
                  ["Year grid"],
                ),
                h.button(
                  [
                    h.Type("button"),
                    h.AriaPressed(String(model.mode === "timeline")),
                    h.OnClick(Message.ChangedMode({ mode: "timeline" })),
                  ],
                  ["Timeline"],
                ),
              ],
            ),
            h.button(
              [h.Type("button"), h.Class("ui-button commands-button"), h.OnClick(act("commands"))],
              ["Commands", h.kbd([], [`${modKeyLabel(model.platform)}K`])],
            ),
          ]
        : [
            h.button(
              [
                h.Type("button"),
                h.Class("ui-button"),
                h.AriaLabel(model.mode === "grid" ? "Switch to timeline" : "Switch to year grid"),
                h.OnClick(
                  Message.ChangedMode({ mode: model.mode === "grid" ? "timeline" : "grid" }),
                ),
              ],
              [model.mode === "grid" ? "▥" : "▦"],
            ),
            h.button(
              [
                h.Type("button"),
                h.Class("ui-button"),
                h.AriaLabel("Commands"),
                h.OnClick(act("commands")),
              ],
              ["⋯"],
            ),
          ]),
      h.button(
        [
          h.Type("button"),
          h.Class("ui-button theme-button"),
          h.AriaLabel(`Switch to ${nextThemeMode(model.theme)} theme`),
          h.OnClick(act("theme")),
        ],
        ["◐"],
      ),
      ...(model.width >= 768
        ? [
            h.button(
              [
                h.Type("button"),
                h.Class("ui-button"),
                h.AriaLabel("Appearance settings"),
                h.OnClick(act("settings")),
              ],
              ["⚙"],
            ),
          ]
        : []),
    ],
  );

const demoChrome = (model: Model, h: Builder) =>
  h.div(
    [h.Class("demo-chrome"), h.DataAttribute("app-chrome", "")],
    [
      h.div(
        [h.Class("demo-banner")],
        [
          h.p(
            [],
            [
              h.strong([], ["Demo · Sample data"]),
              h.span([h.Class("phone-notice")], [". Changes stay here. "]),
              h.span([h.Class("desktop-notice")], ["Try it here. Changes stay in this demo."]),
              " ",
              h.a([h.Href("/home")], ["About Julian"]),
            ],
          ),
          h.button(
            [
              h.Type("button"),
              h.Class("ui-button connect-button"),
              h.Disabled(model.connecting),
              h.OnClick(act("connect")),
            ],
            [model.connecting ? "Connecting…" : "Connect my Google Calendar"],
          ),
        ],
      ),
      h.div(
        [h.Class("demo-tour")],
        [
          h.p(
            [h.Class(model.tourRunning ? "tour-caption" : "")],
            [
              model.tourRunning
                ? `Tour ${Math.min(3, model.tour) || 1}/3`
                : "Your turn. Click a day to explore, or add a sample event.",
            ],
          ),
          button(h, model.tourRunning ? "Try it now" : "Watch 15s tour", "tour"),
          button(h, "Add sample event", "create"),
          button(h, "Reset demo", "reset-demo"),
        ],
      ),
    ],
  );

export const view = (model: Model, h: Builder): Document => {
  const calendar = model.page === "calendar" || model.page === "demo";
  const body = calendar
    ? [
        h.main(
          [h.Id("main-content"), h.Class("calendar-app"), h.Tabindex(-1)],
          [
            topbar(model, h),
            ...(model.page === "demo" ? [demoChrome(model, h)] : []),
            ...(model.error
              ? [
                  h.div(
                    [h.Role("alert"), h.Class("error-banner")],
                    [
                      model.error,
                      button(h, "Dismiss", "dismiss-error"),
                      button(h, "Retry", "refresh"),
                    ],
                  ),
                ]
              : []),
            h.div(
              [h.Class("app-body")],
              [
                ...(model.width >= 768 && !model.sidebarCollapsed
                  ? [
                      h.aside(
                        [h.AriaLabel("Calendars"), h.Class("desktop-sidebar")],
                        [calendars(model, h)],
                      ),
                    ]
                  : []),
                h.div(
                  [h.Class("calendar-content")],
                  [
                    ...(model.query
                      ? [
                          h.p(
                            [h.Class("match-count"), h.Role("status")],
                            [
                              `${visibleEvents(model).length} matching event${visibleEvents(model).length === 1 ? "" : "s"}`,
                            ],
                          ),
                        ]
                      : []),
                    ...(model.loading && !model.hydrated
                      ? [h.p([], ["Loading calendar..."])]
                      : [
                          model.mode === "grid" || model.printing
                            ? gridView(model, h)
                            : timelineView(model, h),
                        ]),
                    h.p(
                      [h.Class("sr-only"), h.Role("status"), h.AriaLive("polite")],
                      [model.status],
                    ),
                    ...(model.loading && model.hydrated
                      ? [h.p([h.Class("refreshing")], ["Loading events..."])]
                      : []),
                  ],
                ),
              ],
            ),
          ],
        ),
        dayDetails(model, h),
        dialogView(model, h),
        ...(model.digits
          ? [h.div([h.Class("digit-preview"), h.AriaHidden(true)], [model.digits])]
          : []),
      ]
    : [
        h.main(
          [h.Id("main-content"), h.Class("route-screen"), h.Tabindex(-1)],
          [
            h.h1(
              [],
              [
                model.page === "signed-out"
                  ? `Connect a calendar to see ${model.year}`
                  : model.page === "not-found"
                    ? "Page not found"
                    : model.page === "callback"
                      ? model.error
                        ? "Authentication failed"
                        : "Authorizing with Google..."
                      : "Loading calendar...",
              ],
            ),
            ...(model.page === "signed-out"
              ? [
                  h.p(
                    [],
                    [
                      "Julian reads your Google Calendar in this browser. Connect it, or look around the demo on sample data first.",
                    ],
                  ),
                  button(
                    h,
                    model.connecting ? "Connecting…" : "Connect Google Calendar",
                    "connect",
                  ),
                  h.a([h.Href(`/demo/${model.year}`)], ["Open the demo"]),
                ]
              : []),
            ...(model.error ? [h.p([h.Role("alert"), h.Class("error")], [model.error])] : []),
            ...(model.page === "not-found" || (model.page === "callback" && model.error)
              ? [h.a([h.Href("/home")], ["Go home"])]
              : []),
          ],
        ),
      ];
  return {
    title: `Julian${calendar ? ` · ${model.year}` : ""}`,
    body: h.div(
      [h.Class("julian-root")],
      [h.a([h.Href("#main-content"), h.Class("skip-link")], ["Skip to calendar"]), ...body],
    ),
  };
};
