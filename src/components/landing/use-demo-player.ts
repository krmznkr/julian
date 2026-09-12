import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEMO_SCRIPT, type DemoContext } from "./demo-script";
import { chord, pressChord, sleep, typeInto } from "./demo-input";

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
  const controllerRef = useRef<AbortController | null>(null);
  const focusGrid = useCallback(() => {
    rootRef.current
      ?.querySelector<HTMLElement>("[data-year-grid-root]")
      ?.focus({ preventScroll: true });
  }, [rootRef]);
  const takeControl = useCallback(() => {
    controllerRef.current?.abort();
    setStatus("interactive");
  }, []);
  const replay = useCallback(() => {
    controllerRef.current?.abort();
    setStep(0);
    setCaption(DEMO_SCRIPT[0].caption);
    setStatus("playing");
    setRunId((id) => id + 1);
  }, []);
  const addEvent = useCallback(() => {
    takeControl();
    focusGrid();
    pressChord(chord("n"));
  }, [focusGrid, takeControl]);

  useEffect(() => {
    if (status !== "playing") return;
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    const stopOnInput = (event: Event) => {
      if (
        event.isTrusted &&
        !(event.target instanceof Element && event.target.closest("[data-demo-controls]"))
      )
        takeControl();
    };
    const stopWhenHidden = () => {
      if (document.hidden) takeControl();
    };
    window.addEventListener("keydown", stopOnInput, true);
    window.addEventListener("pointerdown", stopOnInput, true);
    document.addEventListener("visibilitychange", stopWhenHidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry && entry.intersectionRatio < 0.25) takeControl();
      },
      { threshold: 0.25 },
    );
    if (rootRef.current) observer.observe(rootRef.current);
    const ctx: DemoContext = {
      signal,
      wait: (ms) => sleep(ms, signal),
      press: async (spec, holdMs = 400) => {
        if (signal.aborted) return;
        pressChord(chord(spec));
        await sleep(holdMs, signal);
      },
      type: async (selector, text) => {
        if (signal.aborted) return;
        const input = document.querySelector<HTMLInputElement>(selector);
        if (input) await typeInto(input, text, { signal, perCharMs: 25 });
      },
      submitDialog: async () => {
        if (signal.aborted) return;
        document
          .querySelector<HTMLFormElement>("[data-slot='dialog-content'] form")
          ?.requestSubmit();
        await sleep(400, signal);
      },
    };
    const run = async () => {
      await sleep(300, signal);
      if (signal.aborted) return;
      // Replays begin with a closed overlay and the grid focused.
      pressChord(chord("Escape"));
      await sleep(50, signal);
      if (signal.aborted) return;
      focusGrid();
      await DEMO_SCRIPT.reduce(async (previous, beat, index) => {
        await previous;
        if (signal.aborted) return;
        setStep(index);
        setCaption(beat.caption);
        await beat.run(ctx);
        await sleep(400, signal);
      }, Promise.resolve());
      if (!signal.aborted) setStatus("finished");
    };
    void run();
    return () => {
      controller.abort();
      observer.disconnect();
      window.removeEventListener("keydown", stopOnInput, true);
      window.removeEventListener("pointerdown", stopOnInput, true);
      document.removeEventListener("visibilitychange", stopWhenHidden);
    };
  }, [focusGrid, rootRef, runId, status, takeControl]);

  return useMemo(
    () => ({ status, caption, step, replay, takeControl, addEvent }),
    [status, caption, step, replay, takeControl, addEvent],
  );
}
