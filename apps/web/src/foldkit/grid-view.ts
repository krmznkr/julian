import {
  buildMonthSegments,
  formatDateRange,
  isWeekend,
  toDateInputValue,
  type EventSegment,
  type MonthSegments,
} from "@julian/domain";
import { cellDomId } from "@/components/year-view/year-grid-keyboard";
import { visibleYearEventLaneMap } from "@/components/year-view/month-grid-layout";
import { Message, canModify, eventKey, visibleEvents, type Model } from "./model";
import { dateLabel, highlighted, monthName, type Builder } from "./html";

const eventChip = (model: Model, segment: EventSegment, lane: number, h: Builder) => {
  const event = model.events.find((item) => eventKey(item) === segment.id);
  if (!event) return h.span([], []);
  return h.keyed("button")(
    segment.id,
    [
      h.Type("button"),
      h.Class(`calendar-event ${segment.isMultiDay ? "multi-day" : "single-day"}`),
      h.AriaLabel(event.title),
      h.Title(`${event.title} · ${formatDateRange(event)}`),
      h.DataAttribute("event-key", segment.id),
      h.Draggable(event.allDay && canModify(model, event)),
      h.Style({
        "grid-row": `${segment.startDay} / ${segment.endDay + 1}`,
        "grid-column": String(lane),
        "--event-color": event.calendarColor ?? "#555",
      }),
      h.OnClick(Message.ClickedEvent({ key: segment.id })),
    ],
    highlighted(event.title, model, h),
  );
};

const monthColumn = (model: Model, month: MonthSegments, h: Builder) => {
  const lanes = visibleYearEventLaneMap(month.segments);
  const length = new Date(model.year, month.month + 1, 0).getDate();
  return h.keyed("div")(
    `month-${month.month}`,
    [
      h.Class("month-column year-grid-height w-[var(--month-col-width)]"),
      h.DataAttribute("month-column", String(month.month)),
    ],
    [
      h.div(
        [
          h.Class("month-days year-grid-rows"),
          h.Style({
            "grid-template-columns": `repeat(${Math.max(1, lanes.laneCount)}, minmax(0,1fr))`,
          }),
        ],
        [
          ...Array.from({ length: 31 }, (_, index) => {
            const day = index + 1;
            const date = toDateInputValue(new Date(model.year, month.month, day));
            const exists = day <= length;
            const selected = model.date === date;
            const today = model.today === date;
            return h.div(
              [
                ...(exists
                  ? [
                      h.Id(cellDomId(model.year, month.month, day)),
                      h.OnClick(Message.ClickedDate({ date })),
                    ]
                  : []),
                h.DataAttribute("day-cell-frame", String(day)),
                h.Class(
                  `day-frame${exists && isWeekend(model.year, month.month, day) ? " weekend bg-muted/80" : ""}${selected ? " focused ring-2" : ""}${today ? " is-today accent-brand" : ""}`,
                ),
                ...(selected && model.details ? [h.AriaCurrent("true")] : []),
                h.Style({ "grid-row": String(day), "grid-column": "1 / -1" }),
              ],
              exists
                ? [
                    h.span(
                      [h.Class(`day-number${today ? " accent-brand" : ""}`), h.AriaHidden(true)],
                      [String(day)],
                    ),
                  ]
                : [],
            );
          }),
          ...month.segments.map((segment) =>
            eventChip(model, segment, lanes.lanes.get(segment.id) ?? 1, h),
          ),
        ],
      ),
    ],
  );
};

export const gridView = (model: Model, h: Builder) => {
  const months = buildMonthSegments(visibleEvents(model), model.year);
  const activeMonth = Number(model.date.slice(5, 7)) - 1;
  const first = model.printing ? 0 : Math.min(model.firstMonth, activeMonth);
  const last = model.printing ? 11 : Math.max(model.lastMonth, activeMonth);
  const spacer = (count: number, side: string) =>
    h.keyed("div")(
      side,
      [
        h.Class("month-spacer"),
        h.Style({ width: `calc(${count} * (var(--month-col-width) + 4px))` }),
        h.AriaHidden(true),
      ],
      [],
    );
  return h.section(
    [h.Role("region"), h.AriaLabel(`Calendar for ${model.year}`), h.Class("calendar-region")],
    [
      h.div(
        [
          h.Id("year-application"),
          h.Role("application"),
          h.Tabindex(0),
          h.AriaLabel(`Calendar for ${model.year}`),
          h.AriaActiveDescendant(
            cellDomId(model.year, activeMonth, Number(model.date.slice(8, 10))),
          ),
          h.Class("year-grid scrollbar-minimal"),
          h.DataAttribute("year-grid-root", ""),
          h.DataAttribute("year", String(model.year)),
        ],
        [
          h.p([h.Class("sr-only"), h.AriaLive("polite")], [dateLabel(model.date)]),
          h.div(
            [h.Class("year-grid-inner")],
            [
              h.div(
                [h.Class("month-headers"), h.DataAttribute("year-grid-header", "")],
                [
                  h.div([h.Class("gutter-heading")], ["Day"]),
                  spacer(first, "before"),
                  ...months
                    .slice(first, last + 1)
                    .map((month) =>
                      h.keyed("div")(
                        `heading-${month.month}`,
                        [
                          h.Class("month-heading"),
                          h.DataAttribute("month-header", String(month.month)),
                        ],
                        [monthName(month.month)],
                      ),
                    ),
                  spacer(11 - last, "after"),
                ],
              ),
              h.div(
                [h.Class("months-row")],
                [
                  h.div(
                    [h.Class("day-gutter year-grid-height sticky")],
                    Array.from({ length: 31 }, (_, index) =>
                      h.div(
                        [
                          h.Class(
                            `year-grid-text-day${Number(model.today.slice(8, 10)) === index + 1 && model.today.startsWith(String(model.year)) ? " accent-brand" : ""}`,
                          ),
                        ],
                        [h.span([], [String(index + 1)])],
                      ),
                    ),
                  ),
                  spacer(first, "before"),
                  ...months.slice(first, last + 1).map((month) => monthColumn(model, month, h)),
                  spacer(11 - last, "after"),
                ],
              ),
            ],
          ),
        ],
      ),
    ],
  );
};
