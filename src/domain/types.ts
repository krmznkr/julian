export type EventSyncState = "synced" | "pending" | "failed" | "conflict";

export type CalendarSummary = {
  readonly id: string;
  readonly summary: string;
  readonly primary?: boolean;
  readonly backgroundColor?: string | null;
  readonly foregroundColor?: string | null;
  readonly accessRole?: string | null;
};

export type CalendarEvent = {
  readonly id: string;
  readonly title: string;
  readonly description?: string | null;
  readonly start: string;
  readonly end: string;
  readonly allDay: boolean;
  readonly isTimed: boolean;
  readonly calendarId: string;
  readonly calendarColor?: string | null;
  readonly calendarSummary?: string | null;
  readonly htmlLink?: string | null;
  readonly etag?: string | null;
  readonly recurringEventId?: string | null;
  readonly syncState?: EventSyncState;
  readonly lastSyncedAt?: string | null;
  readonly pendingMutationIds?: readonly string[];
};

export type EventSegment = {
  readonly id: string;
  readonly title: string;
  readonly startDay: number;
  readonly endDay: number;
  readonly lane: number;
  readonly calendarColor?: string | null;
  readonly calendarId: string;
  readonly allDay: boolean;
  readonly isTimed: boolean;
  readonly isFirstSegment?: boolean;
  readonly isLastSegment?: boolean;
};

export type MonthSegments = {
  readonly month: number;
  readonly lanes: number;
  readonly segments: readonly EventSegment[];
};
