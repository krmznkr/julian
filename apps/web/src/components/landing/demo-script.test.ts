import { describe, expect } from "vitest";
import { it } from "@effect/vitest";
import { Effect, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { DEMO_SCRIPT, playDemo, type DemoContext } from "./demo-script";

// Records what the tour does, with the virtual time at which it did it.
function recordingContext() {
  const log: Array<{ readonly at: number; readonly action: string }> = [];
  const record = (action: string) =>
    Effect.flatMap(
      Effect.clockWith((clock) => clock.currentTimeMillis),
      (at) => Effect.sync(() => log.push({ at, action })),
    );
  const ctx: DemoContext = {
    press: (spec, holdMs = 400) =>
      record(`press ${spec}`).pipe(Effect.andThen(Effect.sleep(holdMs))),
    type: (_selector, text) => record(`type ${text}`),
    submitDialog: record("submit").pipe(Effect.andThen(Effect.sleep(400))),
    focusGrid: record("focus"),
    beginBeat: (_index, beat) => record(`beat ${beat.id}`),
  };
  return { log, ctx };
}

const actions = (log: ReadonlyArray<{ readonly action: string }>) =>
  log.map((entry) => entry.action);

describe("playDemo", () => {
  it.effect("waits before starting, then resets the view and focuses the grid", () =>
    Effect.gen(function* () {
      const { log, ctx } = recordingContext();
      yield* playDemo(ctx).pipe(Effect.forkChild);

      yield* TestClock.adjust(299);
      expect(log).toEqual([]);

      yield* TestClock.adjust(1);
      expect(actions(log)).toEqual(["press Escape"]);

      yield* TestClock.adjust(50);
      expect(actions(log)).toEqual(["press Escape", "focus", "beat day", "press t"]);
    }),
  );

  it.effect("plays every beat once, in order, and then completes", () =>
    Effect.gen(function* () {
      const { log, ctx } = recordingContext();
      const fiber = yield* playDemo(ctx).pipe(Effect.forkChild);

      yield* TestClock.adjust("1 minute");
      yield* Fiber.join(fiber);

      expect(actions(log).filter((action) => action.startsWith("beat "))).toEqual(
        DEMO_SCRIPT.map((beat) => `beat ${beat.id}`),
      );
      expect(actions(log).filter((action) => action === "submit")).toHaveLength(1);
      expect(actions(log)).toContain("type Dinner with friends");
    }),
  );

  it.effect("schedules each beat after the previous one's holds and pauses", () =>
    Effect.gen(function* () {
      const { log, ctx } = recordingContext();
      yield* playDemo(ctx).pipe(Effect.forkChild);
      yield* TestClock.adjust("1 minute");

      const startOf = (id: string) => log.find((entry) => entry.action === `beat ${id}`)?.at;
      // 300 ms lead-in + 50 ms reset.
      expect(startOf("day")).toBe(350);
      // day: 250 + 600 + 500 + 800 + 250 holds, then the 400 ms gap.
      expect(startOf("add")).toBe(350 + 2400 + 400);
      // add: 300 hold, typing (instant here), 400 pause, 400 submit, 800 pause, then the gap.
      expect(startOf("find")).toBe(350 + 2400 + 400 + 1900 + 400);
    }),
  );

  it.effect("stops mid-beat when interrupted, pressing nothing further", () =>
    Effect.gen(function* () {
      const { log, ctx } = recordingContext();
      const fiber = yield* playDemo(ctx).pipe(Effect.forkChild);

      yield* TestClock.adjust(800);
      yield* Fiber.interrupt(fiber);
      const seen = log.length;

      yield* TestClock.adjust("1 minute");
      expect(log).toHaveLength(seen);
      expect(actions(log)).not.toContain("submit");
    }),
  );
});
