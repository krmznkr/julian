// A believable year of calendar data for the landing-page demo.
//
// Everything is pushed through the real `normalizeEvent`, so the fixture is
// shaped exactly like data that came back from Google — including the rule that
// single-day timed events are dropped. Dates are anchored to *today* so the
// demo always looks like a live account rather than a screenshot from 2023.
import { normalizeEvent, type CalendarEvent, type CalendarSummary } from "@/domain";
import { TASKS_CALENDAR_ID } from "@/lib/google-calendar";

const PERSONAL = "demo-personal";
const WORK = "demo-work";
const FAMILY = "demo-family";
const TRAVEL = "demo-travel";
const BIRTHDAYS = "demo-birthdays";

const DEMO_CALENDARS: CalendarSummary[] = [
  {
    id: PERSONAL,
    summary: "Personal",
    primary: true,
    backgroundColor: "#0b8043",
    foregroundColor: "#ffffff",
    accessRole: "owner",
  },
  {
    id: WORK,
    summary: "Work",
    backgroundColor: "#3f51b5",
    foregroundColor: "#ffffff",
    accessRole: "owner",
  },
  {
    id: FAMILY,
    summary: "Family",
    backgroundColor: "#e67c73",
    foregroundColor: "#ffffff",
    accessRole: "writer",
  },
  {
    id: TRAVEL,
    summary: "Travel",
    backgroundColor: "#f09300",
    foregroundColor: "#ffffff",
    accessRole: "owner",
  },
  {
    id: BIRTHDAYS,
    summary: "Birthdays",
    backgroundColor: "#8e24aa",
    foregroundColor: "#ffffff",
    accessRole: "reader",
  },
  {
    id: TASKS_CALENDAR_ID,
    summary: "Tasks",
    backgroundColor: "#8b5cf6",
    foregroundColor: "#ffffff",
    accessRole: "reader",
  },
];

const CALENDARS_BY_ID = new Map(DEMO_CALENDARS.map((calendar) => [calendar.id, calendar]));

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Local-date key, deliberately not `toISOString()` (which shifts by the UTC offset). */
function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shift(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Local wall-clock ISO string with offset, the way Google returns `dateTime`. */
function dateTimeKey(date: Date, hour: number, minute: number) {
  const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute);
  const offset = -at.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  return `${dateKey(at)}T${pad(hour)}:${pad(minute)}:00${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

type AllDaySeed = {
  kind: "all-day";
  calendarId: string;
  title: string;
  description?: string;
  /** First day, as a `Date`. */
  from: Date;
  /** Inclusive length in days. */
  days?: number;
};

type TimedSeed = {
  kind: "timed";
  calendarId: string;
  title: string;
  description?: string;
  from: Date;
  startHour: number;
  startMinute?: number;
  /** Hours after the start; must cross midnight or the event is (correctly) dropped. */
  durationHours: number;
};

type Seed = AllDaySeed | TimedSeed;

function toCalendarEvent(seed: Seed, index: number): CalendarEvent | null {
  const calendar = CALENDARS_BY_ID.get(seed.calendarId);
  if (!calendar) return null;

  const id = `demo-${index}`;
  if (seed.kind === "all-day") {
    return normalizeEvent(
      {
        id,
        summary: seed.title,
        description: seed.description ?? null,
        start: { date: dateKey(seed.from) },
        // Google's all-day end is exclusive.
        end: { date: dateKey(shift(seed.from, seed.days ?? 1)) },
      },
      calendar,
    );
  }

  const startMinute = seed.startMinute ?? 0;
  const end = new Date(seed.from.getFullYear(), seed.from.getMonth(), seed.from.getDate());
  const endTotalMinutes = seed.startHour * 60 + startMinute + seed.durationHours * 60;
  const endDay = shift(end, Math.floor(endTotalMinutes / (24 * 60)));
  const endMinutes = endTotalMinutes % (24 * 60);

  return normalizeEvent(
    {
      id,
      summary: seed.title,
      description: seed.description ?? null,
      start: { dateTime: dateTimeKey(seed.from, seed.startHour, startMinute) },
      end: { dateTime: dateTimeKey(endDay, Math.floor(endMinutes / 60), endMinutes % 60) },
    },
    calendar,
  );
}

function buildSeeds(year: number, today: Date): Seed[] {
  /** A date in the demo year. `month` is 1-indexed for readability. */
  const on = (month: number, day: number) => new Date(year, month - 1, day);
  const near = (days: number) => shift(today, days);

  const allDay = (
    calendarId: string,
    title: string,
    from: Date,
    days?: number,
    description?: string,
  ): Seed => ({ kind: "all-day", calendarId, title, from, days, description });

  const overnight = (
    calendarId: string,
    title: string,
    from: Date,
    startHour: number,
    startMinute: number,
    durationHours: number,
    description?: string,
  ): Seed => ({
    kind: "timed",
    calendarId,
    title,
    from,
    startHour,
    startMinute,
    durationHours,
    description,
  });

  const seasonal: Seed[] = [
    allDay(FAMILY, "New year at the cabin", on(1, 1), 3),
    allDay(PERSONAL, "Dry January", on(1, 1), 31),
    allDay(WORK, "Q1 kickoff", on(1, 13), 2),
    allDay(BIRTHDAYS, "Nadia's birthday", on(1, 24)),
    allDay(TRAVEL, "Lisbon · design offsite", on(2, 10), 5, "Team week at the studio."),
    allDay(WORK, "Hiring loop · design", on(2, 24), 4),
    allDay(PERSONAL, "Marathon training block", on(3, 3), 42, "18 weeks out. Long runs Sundays."),
    allDay(WORK, "Ship the calendar rewrite", on(3, 27)),
    allDay(TRAVEL, "Kyoto · cherry blossoms", on(4, 4), 10, "Ryokan booked, JR pass collected."),
    allDay(FAMILY, "School holidays", on(4, 14), 12),
    allDay(BIRTHDAYS, "Théo's birthday", on(4, 30)),
    allDay(WORK, "Q2 planning", on(5, 6), 2),
    allDay(PERSONAL, "Bike the coast road", on(5, 24), 3),
    allDay(FAMILY, "Sarah & Malik's wedding", on(6, 21), 2),
    allDay(PERSONAL, "Half marathon · city loop", on(6, 8)),
    allDay(WORK, "Mid-year review", on(6, 27)),
    allDay(TRAVEL, "Sicily · the old house", on(7, 12), 16, "Same house as last year."),
    allDay(WORK, "Summer freeze", on(7, 28), 18),
    allDay(FAMILY, "Grandma's 80th", on(8, 16), 3),
    allDay(BIRTHDAYS, "Amina's birthday", on(8, 29)),
    allDay(WORK, "Berlin · conference", on(9, 9), 4, "Talk on Thursday, 14:00."),
    allDay(PERSONAL, "Back to swimming", on(9, 22), 5),
    allDay(WORK, "Ship v2.0", on(10, 2)),
    allDay(FAMILY, "Half-term · Dordogne", on(10, 20), 8),
    allDay(PERSONAL, "Deep work sprint", on(11, 3), 5, "No meetings. Phone in a drawer."),
    allDay(BIRTHDAYS, "Papa's birthday", on(11, 18)),
    allDay(WORK, "Roadmap week", on(12, 1), 5),
    allDay(FAMILY, "Christmas at home", on(12, 22), 6),
    allDay(PERSONAL, "Year in review", on(12, 30), 2),
  ];

  // A dense cluster around today, so "what's on today" has something to show.
  const thisWeek: Seed[] = [
    allDay(TRAVEL, "Barcelona · client week", near(-2), 6, "Hotel Casa Bonay, room 412."),
    allDay(WORK, "Design review · year grid", today, 1, "Bring the keyboard-nav walkthrough."),
    allDay(TASKS_CALENDAR_ID, "Pay the electricity bill", today),
    allDay(
      TASKS_CALENDAR_ID,
      "Book the chicken for Sunday",
      today,
      1,
      "Call the butcher before 6.",
    ),
    allDay(FAMILY, "Léa's school play", near(1)),
    allDay(TASKS_CALENDAR_ID, "Renew the passport", near(4)),
    allDay(WORK, "Sprint 14", near(-4), 14),
    allDay(PERSONAL, "Dinner with the Alaouis", near(2)),
    overnight(TRAVEL, "Red-eye to SFO", today, 22, 40, 10, "AF 084 · seat 21A."),
    overnight(PERSONAL, "Perseids · out at the lake", near(6), 21, 30, 8),
  ];

  return [...seasonal, ...thisWeek];
}

export function buildDemoYear(
  year: number,
  today = new Date(),
): { calendars: CalendarSummary[]; events: CalendarEvent[] } {
  const events = buildSeeds(year, today)
    .map((seed, index) => toCalendarEvent(seed, index))
    .filter((event): event is CalendarEvent => event !== null);

  return { calendars: DEMO_CALENDARS, events };
}
