// The landing page's calendar is not a mock-up: it is `YearViewCore`, the same
// component the signed-in app renders, wired to local state and an in-memory
// event store instead of the router and Google.
import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import YearViewCore from "@/components/year-view-core";
import { DemoHud, GhostCursor } from "@/components/landing/demo-hud";
import { buildDemoYear } from "@/components/landing/demo-data";
import { useDemoPlayer } from "@/components/landing/use-demo-player";
import type {
  YearViewDataSource,
  YearViewEventApi,
  YearViewLoadResult,
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
 * Only the current year is mutable — paging to 2031 just generates a fixture.
 */
function useDemoStore(year: number) {
  const today = useMemo(() => new Date(), []);
  const seed = useMemo(() => buildDemoYear(year, today), [today, year]);
  const eventsRef = useRef<CalendarEvent[]>(seed.events);
  const nextIdRef = useRef(0);

  const dataSource = useMemo<YearViewDataSource>(
    () => ({
      load: (targetYear): Promise<YearViewLoadResult> =>
        Promise.resolve({
          calendars: seed.calendars,
          selectedCalendarIds: seed.calendars.map((calendar) => calendar.id),
          events: targetYear === year ? eventsRef.current : buildDemoYear(targetYear, today).events,
        }),
      // Nothing is written to disk from the landing page.
      persistSelection: () => {},
    }),
    [seed, today, year],
  );

  const eventApi = useMemo<YearViewEventApi>(
    () => ({
      createEvent: (calendar, input) => {
        // eslint-disable-next-line functional/immutable-data
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
          syncState: "synced",
        };
        // The tour loops, so re-adding the same title on the same day replaces
        // the earlier copy instead of stacking duplicates forever.
        // eslint-disable-next-line functional/immutable-data
        eventsRef.current = [
          ...eventsRef.current.filter(
            (event) => !(event.title === created.title && event.start === created.start),
          ),
          created,
        ];
        return Promise.resolve(created);
      },
      updateEvent: (calendarId, eventId, input) => {
        // eslint-disable-next-line functional/immutable-data
        eventsRef.current = eventsRef.current.map((event) =>
          event.id === eventId && event.calendarId === calendarId
            ? { ...event, title: input.title }
            : event,
        );
        return Promise.resolve();
      },
      deleteEvent: (calendarId, eventId) => {
        // eslint-disable-next-line functional/immutable-data
        eventsRef.current = eventsRef.current.filter(
          (event) => !(event.id === eventId && event.calendarId === calendarId),
        );
        return Promise.resolve();
      },
    }),
    [],
  );

  return { dataSource, eventApi, seed, today };
}

export function DemoYearView({ banner }: { banner?: ReactNode }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const year = useMemo(() => new Date().getFullYear(), []);
  const { dataSource, eventApi, seed, today } = useDemoStore(year);

  const [search, setSearch] = useState<YearViewSearch>(() => todaySearch(today));
  const [displayYear, setDisplayYear] = useState(year);

  const navigate = useCallback<YearViewRouterPort["navigate"]>((target) => {
    setDisplayYear(target.year);
    setSearch(target.search);
  }, []);

  const router = useMemo<YearViewRouterPort>(() => ({ search, navigate }), [navigate, search]);

  const initialData = useMemo(
    () => ({
      calendars: seed.calendars,
      selectedCalendarIds: seed.calendars.map((calendar) => calendar.id),
      events: seed.events,
    }),
    [seed],
  );

  const player = useDemoPlayer(containerRef);

  return (
    <div ref={containerRef} className="relative">
      <YearViewCore
        initialYear={displayYear}
        initialData={displayYear === year ? initialData : null}
        router={router}
        dataSource={dataSource}
        eventApi={eventApi}
        banner={banner}
      />
      <DemoHud {...player} />
      <GhostCursor cursor={player.cursor} />
    </div>
  );
}
