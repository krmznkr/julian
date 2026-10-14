// The scripted landing-page tour, as an Effect program.
//
// Every pause is an `Effect.sleep`, so the player stops the tour by
// interrupting its fiber, and tests drive the whole timeline with `TestClock`
// instead of real or faked timers.
import { Effect } from "effect";

export type DemoContext = {
  /** Press a key chord, then hold for `holdMs` so the visitor sees it land. */
  readonly press: (spec: string, holdMs?: number) => Effect.Effect<void>;
  readonly type: (selector: string, text: string) => Effect.Effect<void>;
  readonly submitDialog: Effect.Effect<void>;
  readonly focusGrid: Effect.Effect<void>;
  /** Called as each beat starts, so the HUD can show its caption. */
  readonly beginBeat: (index: number, beat: DemoBeat) => Effect.Effect<void>;
};

export type DemoBeat = {
  readonly id: string;
  readonly caption: string;
  readonly run: (ctx: DemoContext) => Effect.Effect<void>;
};

// One short pass through a real workflow, then hand control to the visitor.
export const DEMO_SCRIPT: readonly DemoBeat[] = [
  {
    id: "day",
    caption: "Open today and browse its events.",
    run: ({ press }) =>
      Effect.gen(function* () {
        yield* press("t", 250);
        yield* press("Enter", 600);
        yield* press("ArrowDown", 500);
        yield* Effect.sleep(800);
        yield* press("Escape", 250);
      }),
  },
  {
    id: "add",
    caption: "Press N to add dinner to the sample calendar.",
    run: ({ press, type, submitDialog }) =>
      Effect.gen(function* () {
        yield* press("n", 300);
        yield* type("[data-slot='dialog-content'] input", "Dinner with friends");
        yield* Effect.sleep(400);
        yield* submitDialog;
        yield* Effect.sleep(800);
      }),
  },
  {
    id: "find",
    caption: "Open commands to jump to a month or change the view.",
    run: ({ press }) =>
      Effect.gen(function* () {
        yield* press("Meta+k", 600);
        yield* Effect.sleep(1100);
        yield* press("Escape", 250);
      }),
  },
];

export const playDemo = (ctx: DemoContext): Effect.Effect<void> =>
  Effect.gen(function* () {
    yield* Effect.sleep(300);
    // Replays begin with a closed overlay and the grid focused.
    yield* ctx.press("Escape", 50);
    yield* ctx.focusGrid;
    yield* Effect.forEach(
      DEMO_SCRIPT,
      (beat, index) =>
        Effect.gen(function* () {
          yield* ctx.beginBeat(index, beat);
          yield* beat.run(ctx);
          yield* Effect.sleep(400);
        }),
      { discard: true },
    );
  });
