import { useCallback, useEffect, useMemo, useState } from "react";
import { Effect } from "effect";
import { useLatestFiber } from "@/lib/effect/use-latest-fiber";
import { DEMO_SCRIPT, playDemo, type DemoContext } from "./demo-script";
import { chord, pressChord, typeInto } from "./demo-input";

export type DemoPlayerState = {
  readonly status: "playing" | "interactive" | "finished";
  readonly caption: string;
  readonly step: number;
  readonly replay: () => void;
  readonly takeControl: () => void;
  readonly addEvent: () => void;
};

export function useDemoPlayer(rootRef: React.RefObject<HTMLElement | null>): DemoPlayerState {
  const [status, setStatus] = useState<DemoPlayerState["status"]>(() =>
    window.matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse), (max-width: 767px)")
      .matches
      ? "interactive"
      : "playing",
  );
  const [caption, setCaption] = useState(DEMO_SCRIPT[0].caption);
  const [step, setStep] = useState(0);
  const [runId, setRunId] = useState(0);
  // The tour runs as one fiber: taking control or replaying interrupts it
  // mid-sleep, so no further keys are pressed.
  const tour = useLatestFiber();
  const focusGrid = useCallback(() => {
    rootRef.current
      ?.querySelector<HTMLElement>("[data-year-grid-root]")
      ?.focus({ preventScroll: true });
  }, [rootRef]);
  const takeControl = useCallback(() => {
    tour.interrupt();
    setStatus("interactive");
  }, [tour]);
  const replay = useCallback(() => {
    tour.interrupt();
    setStep(0);
    setCaption(DEMO_SCRIPT[0].caption);
    setStatus("playing");
    setRunId((id) => id + 1);
  }, [tour]);
  const addEvent = useCallback(() => {
    takeControl();
    focusGrid();
    pressChord(chord("n"));
  }, [focusGrid, takeControl]);

  useEffect(() => {
    if (status !== "playing") return;
    const stopOnInput = (event: Event) => {
      if (event.isTrusted) takeControl();
    };
    const stopWhenHidden = () => {
      if (document.hidden) takeControl();
    };
    window.addEventListener("keydown", stopOnInput, true);
    window.addEventListener("pointerdown", stopOnInput, true);
    window.addEventListener("touchstart", stopOnInput, true);
    document.addEventListener("visibilitychange", stopWhenHidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.intersectionRatio < 0.25) takeControl();
      },
      { threshold: 0.25 },
    );
    if (rootRef.current) observer.observe(rootRef.current);
    const ctx: DemoContext = {
      press: (spec, holdMs = 400) =>
        Effect.sync(() => pressChord(chord(spec))).pipe(Effect.andThen(Effect.sleep(holdMs))),
      type: (selector, text) =>
        Effect.suspend(() => {
          const input = document.querySelector<HTMLInputElement>(selector);
          return input ? typeInto(input, text, 25) : Effect.void;
        }),
      submitDialog: Effect.sync(() =>
        document
          .querySelector<HTMLFormElement>("[data-slot='dialog-content'] form")
          ?.requestSubmit(),
      ).pipe(Effect.andThen(Effect.sleep(400))),
      focusGrid: Effect.sync(focusGrid),
      beginBeat: (index, beat) =>
        Effect.sync(() => {
          setStep(index);
          setCaption(beat.caption);
        }),
    };
    tour.run(playDemo(ctx).pipe(Effect.andThen(Effect.sync(() => setStatus("finished")))));
    return () => {
      tour.interrupt();
      observer.disconnect();
      window.removeEventListener("keydown", stopOnInput, true);
      window.removeEventListener("pointerdown", stopOnInput, true);
      window.removeEventListener("touchstart", stopOnInput, true);
      document.removeEventListener("visibilitychange", stopWhenHidden);
    };
  }, [focusGrid, rootRef, runId, status, takeControl, tour]);

  return useMemo(
    () => ({ status, caption, step, replay, takeControl, addEvent }),
    [status, caption, step, replay, takeControl, addEvent],
  );
}
