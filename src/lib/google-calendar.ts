// Google Calendar OAuth & API integration (frontend-only, no backend required)
// Uses PKCE flow for security without a backend
import { resolveSelectedCalendarIds } from "@/lib/calendar-selection";
import type { CalendarEvent, CalendarSummary } from "@/domain";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
// We redirect to our own /auth/callback route on whatever origin the app is
// served from (localhost in dev, julian.krmznkr.com in prod).
const REDIRECT_URI =
  typeof location !== "undefined"
    ? `${location.origin}/auth/callback`
    : "http://localhost:3000/auth/callback";
// Same-origin Worker endpoints run the confidential web token exchange.
const OAUTH_PROXY_BASE = "/api/oauth";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  // Read+write access to events so we can create and delete them in-app. The
  // broader calendar.readonly scope is kept so we can still list calendars.
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/tasks.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

// Single synthetic calendar that groups every Google Task behind one checkbox,
// regardless of which task list each task belongs to.
export const TASKS_CALENDAR_ID = "__google_tasks__";
const TASKS_CALENDAR_COLOR = "#8b5cf6";

const STORAGE_KEYS = {
  accessToken: "google:access_token",
  refreshToken: "google:refresh_token",
  expiresAt: "google:expires_at",
  codeVerifier: "google:pkce_verifier",
};

function generateRandomString(length = 64): string {
  const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  return Array.from({ length }, () =>
    charset.charAt(Math.floor(Math.random() * charset.length)),
  ).join("");
}

async function sha256(text: string): Promise<string> {
  const buffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const binaryString = String.fromCharCode(...hashArray);
  const base64 = btoa(binaryString);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refreshToken) return null;

  // Web delegates to the Worker proxy so the confidential web-client secret
  // stays server-side.
  const response = await fetch(`${OAUTH_PROXY_BASE}/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!response.ok) {
    clearStoredToken();
    return null;
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
  localStorage.setItem(STORAGE_KEYS.expiresAt, String(Date.now() + data.expires_in * 1000));
  if (data.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
  }

  return data.access_token;
}

async function getStoredToken(): Promise<string | null> {
  const token = localStorage.getItem(STORAGE_KEYS.accessToken);
  const expiresAt = localStorage.getItem(STORAGE_KEYS.expiresAt);

  // Refresh 60s before the real expiry to avoid mid-request failures.
  if (token && expiresAt && Date.now() < parseInt(expiresAt, 10) - 60_000) {
    return token;
  }

  return refreshAccessToken();
}

function clearStoredToken(): void {
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.expiresAt);
}

function buildAuthUrl(codeChallenge: string, redirectUri: string): string {
  const params = new URLSearchParams([
    ["client_id", GOOGLE_CLIENT_ID],
    ["redirect_uri", redirectUri],
    ["response_type", "code"],
    ["scope", SCOPES.join(" ")],
    ["code_challenge", codeChallenge],
    ["code_challenge_method", "S256"],
    ["prompt", "consent"],
    ["access_type", "offline"],
  ]);

  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function startGoogleAuth(): Promise<void> {
  if (!GOOGLE_CLIENT_ID) {
    throw new Error("Missing VITE_GOOGLE_CLIENT_ID. Set it in .env and rebuild.");
  }
  const codeVerifier = generateRandomString();
  const codeChallenge = await sha256(codeVerifier);

  localStorage.setItem(STORAGE_KEYS.codeVerifier, codeVerifier);

  location.assign(buildAuthUrl(codeChallenge, REDIRECT_URI));
}

export async function handleAuthCallback(
  code: string,
  redirectUri: string = REDIRECT_URI,
): Promise<void> {
  const codeVerifier = localStorage.getItem(STORAGE_KEYS.codeVerifier);
  if (!codeVerifier) {
    throw new Error("No code verifier found. Please try logging in again.");
  }

  // Web posts the code to the Worker proxy, which adds the confidential
  // web-client secret server-side.
  const response = await fetch(`${OAUTH_PROXY_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, code_verifier: codeVerifier, redirect_uri: redirectUri }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    try {
      const errorData = JSON.parse(errorText);
      console.error(`Token exchange failed: ${errorData.error} - ${errorData.error_description}`);
    } catch {
      console.error(`Token exchange failed: ${response.status} ${errorText}`);
    }
    throw new Error("Failed to exchange authorization code for token");
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
  };

  localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
  localStorage.setItem(STORAGE_KEYS.expiresAt, String(Date.now() + data.expires_in * 1000));
  if (data.refresh_token) {
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
  }

  localStorage.removeItem(STORAGE_KEYS.codeVerifier);
}

export async function isAuthenticated(): Promise<boolean> {
  return (await getStoredToken()) !== null;
}

export function logout(): void {
  clearStoredToken();
}

export async function getCalendars(): Promise<
  Array<{
    id: string;
    summary: string;
    primary?: boolean;
    backgroundColor?: string;
    foregroundColor?: string;
    accessRole?: string;
  }>
> {
  const token = await getStoredToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch calendars");
  }

  const data = (await response.json()) as {
    items: Array<{
      id: string;
      summary: string;
      primary?: boolean;
      backgroundColor?: string;
      foregroundColor?: string;
      accessRole?: string;
    }>;
  };

  return data.items || [];
}

export async function getEvents(
  calendarId: string,
  startDate: Date,
  endDate: Date,
): Promise<
  Array<{
    id: string;
    title: string;
    description?: string;
    start: string;
    end: string;
    allDay: boolean;
    isTimed: boolean;
    htmlLink?: string;
    recurringEventId?: string;
  }>
> {
  const token = await getStoredToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const timeMin = startDate.toISOString();
  const timeMax = endDate.toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "2500",
  });

  type GoogleCalendarEvent = {
    id: string;
    summary: string;
    description?: string;
    htmlLink?: string;
    recurringEventId?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  };
  type GoogleCalendarEventsPage = {
    items: Array<{
      id: string;
      summary: string;
      description?: string;
      htmlLink?: string;
      recurringEventId?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
    }>;
    nextPageToken?: string;
  };

  async function fetchPage(
    pageParams: URLSearchParams,
    accumulated: GoogleCalendarEvent[] = [],
  ): Promise<GoogleCalendarEvent[]> {
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${pageParams}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch events from calendar ${calendarId}`);
    }

    const data = (await response.json()) as GoogleCalendarEventsPage;
    const events = [...accumulated, ...(data.items || [])];
    if (!data.nextPageToken) {
      return events;
    }

    const nextParams = new URLSearchParams(pageParams);
    nextParams.set("pageToken", data.nextPageToken);
    return fetchPage(nextParams, events);
  }

  const events = await fetchPage(params);

  return events.map((event) => {
    const isAllDay = !event.start?.dateTime;
    const start = (event.start?.dateTime || event.start?.date) ?? "";
    const end = (event.end?.dateTime || event.end?.date) ?? "";

    return {
      id: event.id,
      title: event.summary || "(No title)",
      description: event.description,
      htmlLink: event.htmlLink,
      recurringEventId: event.recurringEventId,
      start,
      end,
      allDay: isAllDay,
      isTimed: !isAllDay,
    };
  });
}

async function getTaskLists(): Promise<Array<{ id: string; title: string }>> {
  const token = await getStoredToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch("https://www.googleapis.com/tasks/v1/users/@me/lists", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch task lists");
  }

  const data = (await response.json()) as { items?: Array<{ id: string; title: string }> };
  return data.items || [];
}

async function getTasksForList(
  taskListId: string,
): Promise<Array<{ id: string; title?: string; notes?: string; due?: string; status?: string }>> {
  const token = await getStoredToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const params = new URLSearchParams({
    showCompleted: "false",
    maxResults: "100",
  });

  const response = await fetch(
    `https://www.googleapis.com/tasks/v1/lists/${encodeURIComponent(taskListId)}/tasks?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch tasks from list ${taskListId}`);
  }

  const data = (await response.json()) as {
    items?: Array<{ id: string; title?: string; notes?: string; due?: string; status?: string }>;
  };
  return data.items || [];
}

function toUtcDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const WRITABLE_ROLES = new Set(["owner", "writer"]);

// A calendar accepts new/deleted events when it isn't the synthetic Tasks
// calendar and we hold owner/writer access. accessRole can be absent on older
// cached data — treat unknown as writable since Google enforces the real
// permission on the request anyway.
export function isWritableCalendar(
  calendar: Pick<CalendarSummary, "id" | "accessRole"> | undefined | null,
): boolean {
  if (!calendar) return false;
  if (calendar.id === TASKS_CALENDAR_ID) return false;
  return calendar.accessRole == null || WRITABLE_ROLES.has(calendar.accessRole);
}

// The calendar a quick-add event lands in: the primary calendar when writable,
// otherwise the first writable calendar.
export function getDefaultWritableCalendar(calendars: CalendarSummary[]): CalendarSummary | null {
  const primary = calendars.find((calendar) => calendar.primary && isWritableCalendar(calendar));
  if (primary) return primary;
  return calendars.find((calendar) => isWritableCalendar(calendar)) ?? null;
}

// Creates an all-day event on the given date (YYYY-MM-DD) and returns it mapped
// to the same CalendarEvent shape the year grid renders.
export async function createEvent(
  calendar: Pick<CalendarSummary, "id" | "summary" | "backgroundColor">,
  input: { title: string; date: string },
): Promise<CalendarEvent> {
  const token = await getStoredToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const [year, month, day] = input.date.split("-").map(Number);
  const endDate = toUtcDateOnly(new Date(Date.UTC(year, month - 1, day + 1)));

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendar.id)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: input.title,
        start: { date: input.date },
        end: { date: endDate },
      }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to create event");
  }

  const event = (await response.json()) as {
    id: string;
    summary?: string;
    description?: string;
    htmlLink?: string;
    start?: { date?: string; dateTime?: string };
    end?: { date?: string; dateTime?: string };
  };

  return {
    id: event.id,
    title: event.summary || input.title,
    description: event.description ?? null,
    start: (event.start?.dateTime || event.start?.date) ?? input.date,
    end: (event.end?.dateTime || event.end?.date) ?? endDate,
    allDay: true,
    isTimed: false,
    calendarId: calendar.id,
    calendarColor: calendar.backgroundColor ?? null,
    calendarSummary: calendar.summary,
    htmlLink: event.htmlLink ?? null,
  };
}

// Renames an event by patching its summary; start/end and all-day-ness are left
// untouched so timed and multi-day events keep their schedule.
export async function updateEvent(
  calendarId: string,
  eventId: string,
  input: { title: string },
): Promise<void> {
  const token = await getStoredToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ summary: input.title }),
    },
  );

  if (!response.ok) {
    throw new Error("Failed to update event");
  }
}

export async function deleteEvent(calendarId: string, eventId: string): Promise<void> {
  const token = await getStoredToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    },
  );

  // 410 Gone means the event is already deleted — treat that as success.
  if (!response.ok && response.status !== 410) {
    throw new Error("Failed to delete event");
  }
}

// Loads every Google Task that has a due date, across all lists, as an all-day
// item belonging to the single synthetic Tasks calendar. Tasks are date-based,
// so they are modelled as all-day events spanning the due day.
async function loadGoogleTaskEvents(year: number) {
  const lists = await getTaskLists();

  const tasksByList = await Promise.all(
    lists.map(async (list) => {
      try {
        return await getTasksForList(list.id);
      } catch {
        console.warn(`Failed to load tasks from list ${list.id}`);
        return [];
      }
    }),
  );

  return tasksByList
    .flat()
    .flatMap((task) => {
      if (!task.due || task.status === "completed") return [];
      const due = new Date(task.due);
      const start = toUtcDateOnly(due);
      const end = toUtcDateOnly(
        new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate() + 1)),
      );
      return [
        {
          id: `task:${task.id}`,
          title: task.title || "(No title)",
          description: task.notes,
          start,
          end,
          allDay: true,
          isTimed: false,
          calendarId: TASKS_CALENDAR_ID,
          calendarColor: TASKS_CALENDAR_COLOR,
          calendarSummary: "Tasks",
        },
      ];
    })
    .filter((event) => Number(event.start.slice(0, 4)) === year);
}

export async function loadGoogleYearData(year: number) {
  const calendars = await getCalendars();

  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year + 1, 0, 1);

  const allEvents = await Promise.all(
    calendars.map(async (calendar) => {
      try {
        const events = await getEvents(calendar.id, startDate, endDate);
        return events.map((event) => ({
          ...event,
          calendarId: calendar.id,
          calendarColor: calendar.backgroundColor,
          calendarSummary: calendar.summary,
        }));
      } catch {
        console.warn(`Failed to load events from calendar ${calendar.id}`);
        return [];
      }
    }),
  );

  const taskEvents = await loadGoogleTaskEvents(year).catch((err) => {
    console.warn("Failed to load Google Tasks:", err);
    return [] as Awaited<ReturnType<typeof loadGoogleTaskEvents>>;
  });

  const tasksCalendar = {
    id: TASKS_CALENDAR_ID,
    summary: "Tasks",
    backgroundColor: TASKS_CALENDAR_COLOR,
    foregroundColor: "#ffffff",
    accessRole: "reader",
  };
  const allCalendars = [...calendars, tasksCalendar];

  return {
    calendars: allCalendars,
    selectedCalendarIds: resolveSelectedCalendarIds(allCalendars.map((c) => c.id)),
    events: [...allEvents.flat(), ...taskEvents],
  };
}
