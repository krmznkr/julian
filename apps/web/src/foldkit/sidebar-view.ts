import { CircleAlert, Info, RefreshCw } from "lucide";
import { BUILD_INFO, buildLabel } from "@/lib/build-info";
import { cn } from "@/lib/utils";
import { Message, visibleEvents, type Model } from "./model";
import { act, type Builder } from "./html";
import { icon } from "./icons";
import { buttonClass, checkboxClass } from "./ui";

const googleAccount = (model: Model, h: Builder, drawer: boolean) => {
  const id = h.Id(drawer ? "drawer-connect" : "sidebar-connect");
  return model.page === "calendar"
    ? h.div(
        [h.Class("mb-4 rounded-lg border border-border/60 bg-muted/30 p-3")],
        [
          h.div(
            [h.Class("mb-2 flex items-center justify-between gap-2")],
            [
              h.span([h.Class("text-xs font-medium text-muted-foreground")], ["Google Calendar"]),
              h.div([h.Class("size-2 rounded-full bg-green-500")], []),
            ],
          ),
          h.button(
            [
              id,
              h.Type("button"),
              h.Class(buttonClass("outline", "sm", "h-7 w-full text-xs")),
              h.OnClick(act("logout")),
            ],
            ["Disconnect", h.span([h.Class("sr-only")], [" Google Calendar"])],
          ),
        ],
      )
    : h.div(
        [h.Class("mb-4")],
        [
          h.button(
            [
              id,
              h.Type("button"),
              h.Class(buttonClass("outline", "sm", "h-8 w-full text-xs")),
              h.Disabled(model.connecting),
              h.OnClick(act("connect")),
            ],
            [model.connecting ? "Connecting..." : "Connect Google Calendar"],
          ),
        ],
      );
};

const skeleton = (h: Builder) =>
  h.div(
    [h.Class("space-y-1"), h.AriaHidden(true)],
    [1, 2, 3, 4].map(() =>
      h.div(
        [h.Class("flex min-h-10 items-center gap-2.5 rounded-md px-2 py-1.5")],
        [
          h.div(
            [
              h.Class(
                "size-3.5 shrink-0 animate-pulse rounded border border-border/40 bg-muted/50",
              ),
            ],
            [],
          ),
          h.div(
            [h.Class("flex min-w-0 flex-1 items-center gap-1.5")],
            [
              h.div([h.Class("h-2 w-2 shrink-0 animate-pulse rounded-full bg-muted/50")], []),
              h.div([h.Class("h-3 max-w-[120px] flex-1 animate-pulse rounded bg-muted/50")], []),
            ],
          ),
        ],
      ),
    ),
  );

const calendarRows = (model: Model, h: Builder) =>
  h.div(
    [h.Class("space-y-1")],
    model.calendars.map((calendar) =>
      h.keyed("div")(
        calendar.id,
        [
          h.Class(
            "group flex min-h-10 items-center gap-1 rounded-md px-2 py-1.5 transition-colors focus-within:bg-muted/55 hover:bg-muted/55",
          ),
        ],
        [
          h.label(
            [
              h.Title(calendar.summary),
              h.Class("flex min-w-0 flex-1 cursor-pointer items-center gap-2.5"),
            ],
            [
              h.input([
                h.Type("checkbox"),
                h.Class(checkboxClass),
                h.Checked(model.selectedCalendarIds.includes(calendar.id)),
                h.OnChange(() => Message.ClickedCalendar({ id: calendar.id })),
              ]),
              h.span(
                [h.Class("flex min-w-0 flex-1 items-center gap-2.5")],
                [
                  h.span(
                    [
                      h.Class("h-2.5 w-2.5 shrink-0 rounded-full"),
                      h.Style({ "background-color": calendar.backgroundColor ?? "#8b8b8b" }),
                      h.AriaHidden(true),
                    ],
                    [],
                  ),
                  h.span([h.Class("truncate text-[13px] text-foreground")], [calendar.summary]),
                ],
              ),
            ],
          ),
        ],
      ),
    ),
  );

const failures = (model: Model, h: Builder) =>
  model.failures.length === 0
    ? []
    : [
        h.div(
          [
            h.Role("status"),
            h.Class("mb-4 space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3"),
          ],
          [
            h.div(
              [h.Class("flex items-start gap-2")],
              [
                icon(CircleAlert, "mt-0.5 size-4 flex-shrink-0 text-destructive"),
                h.div(
                  [h.Class("flex-1 space-y-1 text-xs text-destructive")],
                  [
                    h.p([], ["Some calendars could not be loaded:"]),
                    ...model.failures.map((failure) =>
                      h.p([], [`${failure.source}: ${failure.message}`]),
                    ),
                  ],
                ),
              ],
            ),
            h.button(
              [
                h.Type("button"),
                h.Class(
                  buttonClass(
                    "outline",
                    "sm",
                    "h-8 w-full border-destructive/30 text-xs text-destructive hover:bg-destructive/10",
                  ),
                ),
                h.OnClick(act("refresh")),
              ],
              ["Retry"],
            ),
          ],
        ),
      ];

export const calendars = (model: Model, h: Builder, drawer = false) => {
  const count = visibleEvents(model).length;
  return h.div(
    [h.Class("flex h-full flex-col"), h.DataAttribute("sidebar-root", "")],
    [
      ...failures(model, h),
      h.div(
        [h.Class("flex-1 overflow-y-auto")],
        [
          h.div(
            [h.Class("space-y-4")],
            [
              googleAccount(model, h, drawer),
              h.div(
                [h.Class("flex items-center justify-between px-1")],
                [
                  h.h2(
                    [
                      h.Class(
                        "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                      ),
                    ],
                    ["Calendars"],
                  ),
                  h.div(
                    [h.Class("flex items-center gap-2")],
                    [
                      ...(model.calendars.length > 0
                        ? [
                            h.span(
                              [h.Class("text-xs text-muted-foreground")],
                              [`${model.selectedCalendarIds.length}/${model.calendars.length}`],
                            ),
                          ]
                        : []),
                      h.button(
                        [
                          h.Type("button"),
                          h.Class(
                            buttonClass("ghost", "icon-sm", "size-7 text-muted-foreground/80"),
                          ),
                          h.AriaLabel("Reload calendars"),
                          h.Disabled(model.loading),
                          h.OnClick(act("refresh")),
                        ],
                        [icon(RefreshCw, cn("size-3.5", model.loading && "animate-spin"))],
                      ),
                    ],
                  ),
                ],
              ),
              ...(model.loading && model.calendars.length === 0
                ? [
                    h.div(
                      [h.Class("space-y-3")],
                      [
                        skeleton(h),
                        h.div(
                          [h.Class("flex items-center gap-2 px-1")],
                          [
                            h.div(
                              [
                                h.Class(
                                  "size-1.5 animate-pulse rounded-full bg-muted-foreground/40",
                                ),
                              ],
                              [],
                            ),
                            h.p(
                              [h.Class("text-xs text-muted-foreground/70")],
                              ["Loading calendars..."],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ]
                : [
                    calendarRows(model, h),
                    h.div(
                      [h.Class("space-y-2 px-1")],
                      [
                        ...(model.calendars.length === 0 && !model.loading
                          ? [
                              h.div(
                                [
                                  h.Class(
                                    "space-y-2 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground/80",
                                  ),
                                ],
                                [
                                  h.p(
                                    [],
                                    ["Connect Google Calendar to see your calendars and events."],
                                  ),
                                ],
                              ),
                            ]
                          : []),
                        ...(count === 0 && model.selectedCalendarIds.length > 0 && !model.loading
                          ? [
                              h.div(
                                [h.Class("flex items-start gap-2 rounded-md bg-muted/30 p-2")],
                                [
                                  icon(
                                    Info,
                                    "mt-0.5 size-3.5 flex-shrink-0 text-muted-foreground/60",
                                  ),
                                  h.p(
                                    [h.Class("flex-1 text-xs text-muted-foreground/70")],
                                    ["No events found"],
                                  ),
                                ],
                              ),
                            ]
                          : []),
                        ...(model.loading && model.hydrated
                          ? [
                              h.div(
                                [h.Class("flex items-center gap-2")],
                                [
                                  h.div(
                                    [
                                      h.Class(
                                        "size-1.5 animate-pulse rounded-full bg-muted-foreground/40",
                                      ),
                                    ],
                                    [],
                                  ),
                                  h.p(
                                    [h.Class("text-xs text-muted-foreground/70")],
                                    ["Loading events..."],
                                  ),
                                ],
                              ),
                            ]
                          : []),
                      ],
                    ),
                  ]),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class("mt-4 space-y-1 border-t border-border/40 pt-3")],
        [
          ...(count > 0
            ? [
                h.div(
                  [h.Class("flex items-center justify-between px-1 text-xs text-muted-foreground")],
                  [
                    h.span([], [`${count} ${count === 1 ? "event" : "events"}`]),
                    h.span([], [String(model.year)]),
                  ],
                ),
              ]
            : []),
          h.p(
            [
              h.Class("truncate px-1 text-[10px] text-muted-foreground"),
              h.Title(
                `Julian ${BUILD_INFO.version} · ${BUILD_INFO.channel} · ${BUILD_INFO.commit}`,
              ),
            ],
            [buildLabel(BUILD_INFO)],
          ),
        ],
      ),
    ],
  );
};
