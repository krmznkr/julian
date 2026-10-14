// The landing page's calendar is not a mock-up: it is `YearViewCore`, the same
// component the signed-in app renders, wired to local state and an in-memory
// event store instead of the router and Google.
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import YearViewCore from "@/components/year-view-core";
import { DemoHud } from "@/components/landing/demo-hud";
import { buildDemoYear } from "@/components/landing/demo-data";
import { useDemoPlayer } from "@/components/landing/use-demo-player";
import type {
  YearViewDataSource,
  YearViewEventApi,
  YearViewLoadResult,
  YearViewPreferences,
  YearViewRouterPort,
} from "@/components/year-view/year-view-ports";
import type { CalendarEvent } from "@/domain";
import type { YearViewSearch } from "@/lib/year-view-url";

function todaySearch(today: Date): YearViewSearch {
  return { month: today.getMonth() + 1, day: today.getDate() };
}

/**
 * Mutations are kept in a ref rather than component state: the year view owns
 * the rendered copy of the events, and this store only has to survive a
 * `loadData()` round trip so a created event doesn't vanish on reconcile.
 * Each visited year keeps its own events until the demo is reset.
 */
function useDemoStore(year: number) {
  const today = useMemo(() => new Date(), []);
  const seed = useMemo(() => buildDemoYear(year, today), [today, year]);
  const eventsRef = useRef<Record<number, CalendarEvent[]>>({ [year]: seed.events });
  const nextIdRef = useRef(0);
  // Held here rather than recomputed from the seed on every load, so a calendar
  // the visitor unchecks stays unchecked across a refresh or a year change.
  const selectionRef = useRef<string[]>(seed.calendars.map((calendar) => calendar.id));

  const dataSource = useMemo<YearViewDataSource>(
    () => ({
      load: (targetYear): Promise<YearViewLoadResult> => {
        if (!eventsRef.current[targetYear])
          eventsRef.current = {
            ...eventsRef.current,
            [targetYear]: buildDemoYear(targetYear, today).events,
          };
        return Promise.resolve({
          calendars: seed.calendars,
          selectedCalendarIds: selectionRef.current,
          events: eventsRef.current[targetYear],
          failures: [],
        });
      },
      // Remembered for this visit only; nothing is written to disk.
      persistSelection: (_availableIds, selectedIds) => {
        selectionRef.current = [...selectedIds];
      },
    }),
    [seed, today],
  );

  const eventApi = useMemo<YearViewEventApi>(
    () => ({
      createEvent: (calendar, input) => {
        nextIdRef.current += 1;
        // All-day ends are exclusive, so a one-day event ends the next morning.
        const [y, m, d] = input.date.split("-").map(Number);
        const endDate = new Date(y ?? 0, (m ?? 1) - 1, (d ?? 1) + 1);
        const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;
        const created: CalendarEvent = {
          id: `demo-local-${nextIdRef.current}`,
          title: input.title,
          description: null,
          start: input.date,
          end,
          allDay: true,
          isTimed: false,
          calendarId: calendar.id,
          calendarColor: calendar.backgroundColor ?? null,
          calendarSummary: calendar.summary,
          htmlLink: null,
        };
        // Re-adding the same title on the same day replaces the earlier copy.
        const targetYear = Number(input.date.slice(0, 4));
        const existing = eventsRef.current[targetYear] ?? buildDemoYear(targetYear, today).events;
        eventsRef.current = {
          ...eventsRef.current,
          [targetYear]: [
            ...existing.filter(
              (event) => !(event.title === created.title && event.start === created.start),
            ),
            created,
          ],
        };
        return Promise.resolve(created);
      },
      updateEvent: (calendarId, eventId, input) => {
        eventsRef.current = Object.fromEntries(
          Object.entries(eventsRef.current).map(([key, events]) => [
            key,
            events.map((event) =>
              event.id === eventId && event.calendarId === calendarId
                ? { ...event, title: input.title }
                : event,
            ),
          ]),
        );
        return Promise.resolve();
      },
      deleteEvent: (calendarId, eventId) => {
        eventsRef.current = Object.fromEntries(
          Object.entries(eventsRef.current).map(([key, events]) => [
            key,
            events.filter((event) => !(event.id === eventId && event.calendarId === calendarId)),
          ]),
        );
        return Promise.resolve();
      },
    }),
    [today],
  );

  const collapsedRef = useRef(false);
  const preferences = useMemo<YearViewPreferences>(
    () => ({
      getSidebarCollapsed: () => collapsedRef.current,
      setSidebarCollapsed: (collapsed) => {
        collapsedRef.current = collapsed;
      },
    }),
    [],
  );

  const initialData = useMemo(
    () => ({
      calendars: seed.calendars,
      selectedCalendarIds: selectionRef.current,
      events: seed.events,
    }),
    [seed],
  );

  return { dataSource, eventApi, preferences, initialData, today };
}

function DemoSession({ banner, onReset }: { banner?: ReactNode; onReset: () => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const year = useMemo(() => new Date().getFullYear(), []);
  const { dataSource, eventApi, preferences, initialData, today } = useDemoStore(year);

  const [search, setSearch] = useState<YearViewSearch>(() => todaySearch(today));
  const [displayYear, setDisplayYear] = useState(year);

  const navigate = useCallback<YearViewRouterPort["navigate"]>((target) => {
    setDisplayYear(target.year);
    setSearch(target.search);
  }, []);

  const router = useMemo<YearViewRouterPort>(() => ({ search, navigate }), [navigate, search]);

  const player = useDemoPlayer(containerRef);

  return (
    <div ref={containerRef} className="relative">
      <YearViewCore
        initialYear={displayYear}
        initialData={displayYear === year ? initialData : null}
        router={router}
        dataSource={dataSource}
        eventApi={eventApi}
        preferences={preferences}
        banner={
          <>
            {banner}
            <DemoHud {...player} onReset={onReset} />
          </>
        }
      />
    </div>
  );
}

export function DemoYearView({ banner }: { banner?: ReactNode }) {
  const [session, setSession] = useState(0);
  const reset = useCallback(() => setSession((value) => value + 1), []);
  return <DemoSession key={session} banner={banner} onReset={reset} />;
}
