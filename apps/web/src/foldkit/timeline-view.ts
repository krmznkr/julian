import {
  buildTimelineRows,
  dateFromDayIndex,
  dayIndexInYear,
  daysInYear,
  formatDateRange,
  eventCalendarSpanDays,
  shiftTimelineWindow,
  TIMELINE_ZOOMS,
} from "@julian/domain";
import {
  formatTimelineRange,
  timelineDayWidth,
  timelineReserveDays,
} from "@/components/year-view/timeline-layout";
import { Message, visibleEvents, type Model } from "./model";
import { button, highlighted, type Builder } from "./html";

export const timelineView = (model: Model, h: Builder) => {
  const width = Math.max(
    320,
    model.width - (model.width >= 768 && !model.sidebarCollapsed ? 224 : 0),
  );
  const dayWidth = timelineDayWidth(width, model.zoom, model.year);
  const rows = buildTimelineRows(
    visibleEvents(model),
    model.selectedCalendarIds,
    model.year,
    (event) => timelineReserveDays(event.title, eventCalendarSpanDays(event), dayWidth),
  );
  const start = model.timelineStart;
  const end = Math.min(
    daysInYear(model.year) - 1,
    dayIndexInYear(
      shiftTimelineWindow(model.zoom, dateFromDayIndex(model.year, start), 1),
      model.year,
    ) - 1,
  );
  const firstKey =
    model.timelineKey ?? rows.flatMap((row) => row.bars).find((bar) => bar.endIndex >= start)?.key;
  return h.section(
    [h.AriaLabel(`Timeline for ${model.year}`), h.Class("timeline-region")],
    [
      h.div(
        [h.Class("timeline-toolbar")],
        [
          h.button(
            [
              h.Type("button"),
              h.AriaLabel(`Previous ${model.zoom}`),
              h.OnClick(Message.ClickedAction({ action: "previous-window" })),
            ],
            ["‹"],
          ),
          h.button(
            [
              h.Type("button"),
              h.AriaLabel(`Next ${model.zoom}`),
              h.OnClick(Message.ClickedAction({ action: "next-window" })),
            ],
            ["›"],
          ),
          h.h2(
            [h.DataAttribute("testid", "timeline-range"), h.AriaLive("polite")],
            [formatTimelineRange(model.year, start, end)],
          ),
          h.div(
            [h.Role("group"), h.AriaLabel("Zoom")],
            TIMELINE_ZOOMS.map((zoom) =>
              h.button(
                [
                  h.Type("button"),
                  h.AriaPressed(String(model.zoom === zoom)),
                  h.OnClick(Message.ChangedZoom({ zoom })),
                ],
                [zoom[0]!.toUpperCase() + zoom.slice(1)],
              ),
            ),
          ),
          button(h, "Today", "today"),
        ],
      ),
      h.div(
        [
          h.DataAttribute("timeline-root", ""),
          h.Id("timeline-scroller"),
          h.Class("timeline-scroll"),
          h.Tabindex(0),
          h.AriaLabel("Timeline events"),
        ],
        [
          h.div(
            [
              h.Class("timeline-track"),
              h.Style({
                width: `${Math.max(width, daysInYear(model.year) * dayWidth)}px`,
                "--day-width": `${dayWidth}px`,
              }),
            ],
            [
              h.div(
                [h.Class("timeline-dates")],
                Array.from({ length: daysInYear(model.year) }, (_, index) =>
                  h.span(
                    [h.Style({ width: `${dayWidth}px` })],
                    [String(dateFromDayIndex(model.year, index).getDate())],
                  ),
                ),
              ),
              ...rows.map((row) => {
                const calendar = model.calendars.find((item) => item.id === row.calendarId);
                return h.div(
                  [
                    h.Role("group"),
                    h.AriaLabel(calendar?.summary ?? "Calendar"),
                    h.Class("timeline-row"),
                    h.Style({ height: `${Math.max(1, row.lanes) * 28 + 36}px` }),
                  ],
                  [
                    h.h3([h.Class("timeline-calendar")], [calendar?.summary ?? "Calendar"]),
                    ...row.bars.map((bar) =>
                      h.button(
                        [
                          h.Type("button"),
                          h.Class("timeline-bar"),
                          h.DataAttribute("timeline-key", bar.key),
                          h.AriaLabel(bar.event.title),
                          h.Tabindex(firstKey === bar.key ? 0 : -1),
                          h.Title(`${bar.event.title} · ${formatDateRange(bar.event)}`),
                          h.Style({
                            left: `${bar.startIndex * dayWidth}px`,
                            top: `${bar.lane * 28 + 30}px`,
                            width: `${Math.max(6, (bar.endIndex - bar.startIndex + 1) * dayWidth - 2)}px`,
                            "--event-color": bar.event.calendarColor ?? "#555",
                          }),
                          h.OnFocus(Message.SelectedEvent({ key: bar.key })),
                          h.OnClick(Message.ClickedEvent({ key: bar.key })),
                        ],
                        highlighted(bar.event.title, model, h),
                      ),
                    ),
                  ],
                );
              }),
            ],
          ),
        ],
      ),
    ],
  );
};
