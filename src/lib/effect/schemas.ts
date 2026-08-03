// Runtime schemas for the external JSON we receive from Google's APIs.
//
// Decoding responses through `Schema` (instead of unchecked `as` casts) means
// malformed or unexpected payloads surface as typed `SchemaError`s in the
// Effect error channel rather than silently becoming `undefined` deep in the
// app. Structs are intentionally permissive about *extra* fields (Google adds
// many) but strict about the shape we depend on.
//
// Absent JSON keys use `Schema.optionalKey`, not `Schema.optional`: in Effect
// v4 `optional` means "the key may be present with an explicit `undefined`",
// which is not what Google's wire format expresses.
import { Schema } from "effect";

// OAuth token endpoint (via the Worker proxy) response.
export const TokenResponse = Schema.Struct({
  access_token: Schema.String,
  expires_in: Schema.Number,
  refresh_token: Schema.optionalKey(Schema.String),
});
export interface TokenResponse extends Schema.Schema.Type<typeof TokenResponse> {}

// calendarList.list item.
export const GoogleCalendarListItem = Schema.Struct({
  id: Schema.String,
  summary: Schema.String,
  primary: Schema.optionalKey(Schema.Boolean),
  backgroundColor: Schema.optionalKey(Schema.String),
  foregroundColor: Schema.optionalKey(Schema.String),
  accessRole: Schema.optionalKey(Schema.String),
});
export interface GoogleCalendarListItem extends Schema.Schema.Type<typeof GoogleCalendarListItem> {}

export const GoogleCalendarList = Schema.Struct({
  items: Schema.optionalKey(Schema.Array(GoogleCalendarListItem)),
});

// events.list item + page.
const EventDateTime = Schema.Struct({
  dateTime: Schema.optionalKey(Schema.String),
  date: Schema.optionalKey(Schema.String),
});

export const GoogleCalendarEvent = Schema.Struct({
  id: Schema.String,
  summary: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  htmlLink: Schema.optionalKey(Schema.String),
  recurringEventId: Schema.optionalKey(Schema.String),
  start: Schema.optionalKey(EventDateTime),
  end: Schema.optionalKey(EventDateTime),
});
export interface GoogleCalendarEvent extends Schema.Schema.Type<typeof GoogleCalendarEvent> {}

export const GoogleCalendarEventsPage = Schema.Struct({
  items: Schema.optionalKey(Schema.Array(GoogleCalendarEvent)),
  nextPageToken: Schema.optionalKey(Schema.String),
});

// The subset of the created-event response we read back.
export const CreatedEvent = Schema.Struct({
  id: Schema.String,
  summary: Schema.optionalKey(Schema.String),
  description: Schema.optionalKey(Schema.String),
  htmlLink: Schema.optionalKey(Schema.String),
  start: Schema.optionalKey(EventDateTime),
  end: Schema.optionalKey(EventDateTime),
});

// Google Tasks.
export const GoogleTaskListItem = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
});
export interface GoogleTaskListItem extends Schema.Schema.Type<typeof GoogleTaskListItem> {}

export const GoogleTaskList = Schema.Struct({
  items: Schema.optionalKey(Schema.Array(GoogleTaskListItem)),
});

export const GoogleTask = Schema.Struct({
  id: Schema.String,
  title: Schema.optionalKey(Schema.String),
  notes: Schema.optionalKey(Schema.String),
  due: Schema.optionalKey(Schema.String),
  status: Schema.optionalKey(Schema.String),
});
export interface GoogleTask extends Schema.Schema.Type<typeof GoogleTask> {}

export const GoogleTasksPage = Schema.Struct({
  items: Schema.optionalKey(Schema.Array(GoogleTask)),
  nextPageToken: Schema.optionalKey(Schema.String),
});
