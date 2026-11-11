import { Schema } from "effect";
import { defineMessageUnion } from "foldkit/message";
import { Url } from "foldkit/url";
import { UrlRequest } from "foldkit/navigation";
import { buildEventKey, buildMonthSegments, isWritableCalendar } from "@julian/domain";

// Google adapters may include an explicit undefined for optional wire fields.
const optionalText = Schema.optional(Schema.NullOr(Schema.String));
export const Event = Schema.Struct({
  id: Schema.String,
  calendarId: Schema.String,
  title: Schema.String,
  start: Schema.String,
  end: Schema.String,
  allDay: Schema.Boolean,
  isTimed: Schema.Boolean,
  calendarColor: optionalText,
  calendarSummary: optionalText,
  description: optionalText,
  htmlLink: optionalText,
  recurringEventId: optionalText,
});
export type Event = typeof Event.Type;
export const Calendar = Schema.Struct({
  id: Schema.String,
  summary: Schema.String,
  backgroundColor: optionalText,
  foregroundColor: optionalText,
  accessRole: optionalText,
  primary: Schema.optional(Schema.Boolean),
});
const Failure = Schema.Struct({ source: Schema.String, message: Schema.String });
const Mode = Schema.Literals(["grid", "timeline"]);
const Page = Schema.Literals([
  "loading",
  "calendar",
  "demo",
  "signed-out",
  "callback",
  "not-found",
]);
const Dialog = Schema.Literals([
  "none",
  "create",
  "edit",
  "move",
  "delete",
  "help",
  "commands",
  "settings",
  "calendars",
]);
export type Dialog = typeof Dialog.Type;
const Zoom = Schema.Literals(["week", "month", "quarter", "year"]);
export const Model = Schema.Struct({
  page: Page,
  href: Schema.String,
  year: Schema.Number,
  date: Schema.String,
  today: Schema.String,
  mode: Mode,
  details: Schema.Boolean,
  selectedKey: Schema.NullOr(Schema.String),
  calendars: Schema.Array(Calendar),
  events: Schema.Array(Event),
  failures: Schema.Array(Failure),
  selectedCalendarIds: Schema.Array(Schema.String),
  loading: Schema.Boolean,
  hydrated: Schema.Boolean,
  loadId: Schema.Number,
  error: Schema.NullOr(Schema.String),
  status: Schema.String,
  dialog: Dialog,
  dialogError: Schema.NullOr(Schema.String),
  busy: Schema.Boolean,
  titleInput: Schema.String,
  moveDate: Schema.String,
  yearInput: Schema.String,
  query: Schema.String,
  commandQuery: Schema.String,
  connecting: Schema.Boolean,
  sidebarCollapsed: Schema.Boolean,
  width: Schema.Number,
  firstMonth: Schema.Number,
  lastMonth: Schema.Number,
  printing: Schema.Boolean,
  theme: Schema.Literals(["system", "light", "dark"]),
  fontSize: Schema.String,
  density: Schema.String,
  platform: Schema.String,
  zoom: Zoom,
  timelineStart: Schema.Number,
  timelineKey: Schema.NullOr(Schema.String),
  nextMoveId: Schema.Number,
  pending: Schema.Array(
    Schema.Struct({
      id: Schema.Number,
      year: Schema.Number,
      before: Event,
      start: Schema.String,
      end: Schema.String,
    }),
  ),
  failNextMove: Schema.Boolean,
  dragKey: Schema.NullOr(Schema.String),
  digits: Schema.String,
  digitKind: Schema.String,
  digitId: Schema.Number,
  tour: Schema.Number,
  tourRunning: Schema.Boolean,
  reducedMotion: Schema.Boolean,
});
export type Model = typeof Model.Type;

const Action = Schema.Literals([
  "today",
  "previous-year",
  "next-year",
  "refresh",
  "sidebar",
  "calendars",
  "close-dialog",
  "create",
  "edit",
  "move",
  "delete",
  "submit",
  "help",
  "commands",
  "settings",
  "theme",
  "connect",
  "logout",
  "clear-search",
  "reset-demo",
  "tour",
  "fail-next",
  "previous-window",
  "next-window",
  "open-event",
  "open-day",
  "dismiss-error",
]);
export const Message = defineMessageUnion({
  Booted: {
    today: Schema.String,
    connected: Schema.Boolean,
    width: Schema.Number,
    theme: Schema.Literals(["system", "light", "dark"]),
    sidebarCollapsed: Schema.Boolean,
    fontSize: Schema.String,
    density: Schema.String,
    platform: Schema.String,
    reducedMotion: Schema.Boolean,
  },
  ChangedUrl: { url: Url },
  ClickedLink: { request: UrlRequest },
  SucceededLoad: {
    id: Schema.Number,
    year: Schema.Number,
    calendars: Schema.Array(Calendar),
    events: Schema.Array(Event),
    selectedCalendarIds: Schema.Array(Schema.String),
    failures: Schema.Array(Failure),
  },
  FailedLoad: { id: Schema.Number, year: Schema.Number, error: Schema.String },
  ClickedAction: { action: Action },
  ChangedField: {
    field: Schema.Literals(["query", "commandQuery", "titleInput", "yearInput", "moveDate"]),
    value: Schema.String,
  },
  SubmittedYear: {},
  ClickedDate: { date: Schema.String },
  ClickedEvent: { key: Schema.String },
  SelectedEvent: { key: Schema.String },
  ClickedCalendar: { id: Schema.String },
  ChangedMode: { mode: Mode },
  ChangedZoom: { zoom: Zoom },
  ChangedSetting: { field: Schema.Literals(["fontSize", "density"]), value: Schema.String },
  PressedKey: {
    key: Schema.String,
    code: Schema.String,
    shift: Schema.Boolean,
    alt: Schema.Boolean,
    mod: Schema.Boolean,
    area: Schema.String,
  },
  ElapsedDigits: { id: Schema.Number },
  SucceededMutation: {
    year: Schema.Number,
    operation: Schema.String,
    event: Schema.NullOr(Event),
    key: Schema.NullOr(Schema.String),
    title: Schema.String,
  },
  FailedMutation: { year: Schema.Number, error: Schema.String },
  SucceededMove: { id: Schema.Number },
  FailedMove: { id: Schema.Number, error: Schema.String },
  StartedDrag: { key: Schema.String },
  DroppedEvent: { date: Schema.String },
  EndedDrag: {},
  ChangedViewport: { width: Schema.Number },
  ScrolledGrid: { first: Schema.Number, last: Schema.Number },
  ChangedPrint: { printing: Schema.Boolean },
  ChangedSystemTheme: { dark: Schema.Boolean },
  SucceededAuth: {},
  FailedAuth: { error: Schema.String },
  LoggedOut: {},
  AdvancedTour: { step: Schema.Number },
  Completed: {},
});
export type Message = typeof Message.Type;

export const eventKey = (event: Event) => buildEventKey(event.id, event.calendarId);
export const selectedEvent = (model: Model) =>
  model.events.find((event) => eventKey(event) === model.selectedKey);
export const canModify = (model: Model, event: Event) =>
  isWritableCalendar(model.calendars.find((calendar) => calendar.id === event.calendarId));
export const isPending = (model: Model, event: Event) =>
  model.pending.some((move) => eventKey(move.before) === eventKey(event));
export const visibleEvents = (model: Model) =>
  model.events.filter(
    (event) =>
      model.selectedCalendarIds.includes(event.calendarId) &&
      `${event.title} ${event.description ?? ""} ${event.calendarSummary ?? ""}`
        .toLowerCase()
        .includes(model.query.trim().toLowerCase()),
  );
export const eventsForDate = (model: Model): readonly Event[] => {
  const visible = visibleEvents(model);
  const segments =
    buildMonthSegments(visible, model.year)[Number(model.date.slice(5, 7)) - 1]?.segments ?? [];
  const day = Number(model.date.slice(8, 10));
  return visible.filter((event) =>
    segments.some(
      (segment) =>
        segment.id === eventKey(event) && segment.startDay <= day && segment.endDay >= day,
    ),
  );
};
export const initialModel = (href = "/"): Model => ({
  page: "loading",
  href,
  year: 2026,
  date: "2026-01-01",
  today: "2026-01-01",
  mode: "grid",
  details: false,
  selectedKey: null,
  calendars: [],
  events: [],
  failures: [],
  selectedCalendarIds: [],
  loading: true,
  hydrated: false,
  loadId: 0,
  error: null,
  status: "Loading calendar...",
  dialog: "none",
  dialogError: null,
  busy: false,
  titleInput: "",
  moveDate: "",
  yearInput: "2026",
  query: "",
  commandQuery: "",
  connecting: false,
  sidebarCollapsed: false,
  width: 1024,
  firstMonth: 0,
  lastMonth: 11,
  printing: false,
  theme: "system",
  fontSize: "medium",
  density: "comfortable",
  platform: "",
  zoom: "quarter",
  timelineStart: 0,
  timelineKey: null,
  nextMoveId: 0,
  pending: [],
  failNextMove: false,
  dragKey: null,
  digits: "",
  digitKind: "",
  digitId: 0,
  tour: 0,
  tourRunning: false,
  reducedMotion: true,
});
