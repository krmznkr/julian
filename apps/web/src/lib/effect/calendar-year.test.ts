// The year aggregation over the real Google service graph and a stubbed fetch.
import { describe, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect } from "effect";
import * as TestEnv from "@julian/google/testing";
import { loadCalendarYear } from "@/lib/effect/calendar-year";

const validToken = TestEnv.validTokenStorage();

const withEnv = (options: {
  readonly responses: ReadonlyArray<Response | (() => Response)>;
  readonly storage?: Readonly<Record<string, string>>;
}) => TestEnv.makeTestEnv(options);

describe("loadCalendarYear", () => {
  it.effect("reports a failed task list while keeping tasks from other lists", () =>
    Effect.gen(function* () {
      const env = yield* withEnv({
        storage: validToken,
        responses: [
          TestEnv.jsonResponse({ items: [] }),
          TestEnv.jsonResponse({
            items: [
              { id: "good", title: "Good" },
              { id: "bad", title: "Bad" },
            ],
          }),
          TestEnv.jsonResponse({
            items: [{ id: "t1", title: "Pay rent", due: "2026-09-01T00:00:00Z" }],
          }),
          TestEnv.jsonResponse({ error: "forbidden" }, 403),
        ],
      });
      const data = yield* loadCalendarYear(2026).pipe(Effect.provide(env.layer));
      expect(data.events.map((event) => event.title)).toEqual(["Pay rent"]);
      expect(data.failures).toEqual([
        { source: "task-list:bad", message: "Failed to fetch tasks from list bad" },
      ]);
    }),
  );
  it.effect("keeps the year usable when one calendar fails, and reports the failure", () =>
    Effect.gen(function* () {
      let call = 0;
      const env = yield* withEnv({
        storage: validToken,
        responses: [
          () => {
            call += 1;
            // 1: calendar list. 2/3: per-calendar events. 4+: tasks.
            if (call === 1) {
              return TestEnv.jsonResponse({
                items: [
                  { id: "good", summary: "Good" },
                  { id: "bad", summary: "Bad" },
                ],
              });
            }
            if (call === 2) {
              return TestEnv.jsonResponse({
                items: [
                  {
                    id: "e1",
                    summary: "Works",
                    start: { date: "2026-03-01" },
                    end: { date: "2026-03-02" },
                  },
                ],
              });
            }
            if (call === 3) return TestEnv.jsonResponse({ error: "boom" }, 500);
            return TestEnv.jsonResponse({ items: [] });
          },
        ],
      });

      const data = yield* loadCalendarYear(2026).pipe(Effect.provide(env.layer));

      // The working calendar still renders...
      expect(data.events.length).toBeGreaterThanOrEqual(1);
      // ...and the broken one is reported rather than silently empty.
      expect(data.failures.length).toBeGreaterThanOrEqual(1);
      expect(data.calendars.map((calendar) => calendar.id)).toContain("good");
    }),
  );
});
