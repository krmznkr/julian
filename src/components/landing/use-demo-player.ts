// Plays the demo script and yields the moment a real person touches anything.
//
// The visitor is always the higher authority here: one trusted keystroke or
// click stops the tour and leaves them holding a working calendar.
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEMO_SCRIPT, type DemoBeat, type DemoContext } from "@/components/landing/demo-script";
import {
  centerOf,
  chord,
  clickElement,
  pressChord,
  sleep,
  typeInto,
} from "@/components/landing/demo-input";

export type DemoPlayerState = {
  readonly status: "playing" | "taken-over" | "reduced-motion" | "static";
  readonly caption: string | null;
  readonly keys: readonly string[] | null;
  readonly cursor: { readonly x: number; readonly y: number } | null;
  readonly replay: () => void;
};

/**
 * A tour of keyboard shortcuts has nothing to say on a phone, and autoplay is
 * exactly what "reduce motion" asks us not to do. Both cases still get the real
 * calendar — just without anyone else's hands on it.
 */
function initialStatus(): DemoPlayerState["status"] {
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.matchMedia("(max-width: 767px)").matches;
  if (coarsePointer || narrow) return "static";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return "reduced-motion";
  return "playing";
}

export function useDemoPlayer(rootRef: React.RefObject<HTMLElement | null>): DemoPlayerState {
  const [status, setStatus] = useState<DemoPlayerState["status"]>(initialStatus);
  const [caption, setCaption] = useState<string | null>(null);
  const [keys, setKeys] = useState<readonly string[] | null>(null);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [onScreen, setOnScreen] = useState(true);
  const [runId, setRunId] = useState(0);

  const replay = useCallback(() => {
    setStatus("playing");
    setRunId((value) => value + 1);
  }, []);

  // A tour running under the fold would fire shortcuts at an app nobody can see.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen((entry?.intersectionRatio ?? 0) > 0.5),
      { threshold: [0, 0.5, 1] },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, [rootRef]);

  // Any trusted input hands the app back to the visitor.
  useEffect(() => {
    if (status !== "playing") return;
    const yieldToUser = (event: Event) => {
      if (!event.isTrusted) return;
      setStatus("taken-over");
      setCaption(null);
      setKeys(null);
      setCursor(null);
    };
    window.addEventListener("keydown", yieldToUser, true);
    window.addEventListener("pointerdown", yieldToUser, true);
    return () => {
      window.removeEventListener("keydown", yieldToUser, true);
      window.removeEventListener("pointerdown", yieldToUser, true);
    };
  }, [status]);

  useEffect(() => {
    if (status !== "playing" || !onScreen) return;

    const controller = new AbortController();
    const { signal } = controller;

    // Dialogs and popovers are portaled to `document.body`, outside the demo
    // container, so the root is a preference rather than a boundary.
    const query = (selector: string) =>
      rootRef.current?.querySelector(selector) ?? document.querySelector(selector);

    // The shell renders the sidebar twice — a mobile drawer and a desktop
    // column — so a plain `querySelector` can resolve to the off-screen copy.
    // Dispatching to it would still work, but the cursor would fly to nowhere.
    const queryVisible = (selector: string) => {
      const scope: ParentNode = rootRef.current ?? document;
      return (
        [...scope.querySelectorAll(selector)].find((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        }) ?? null
      );
    };

    const focusGrid = () => {
      const grid = query("[data-year-grid-root]");
      if (grid instanceof HTMLElement) grid.focus({ preventScroll: true });
    };

    const context: DemoContext = {
      signal,
      query,
      focusGrid,
      wait: (ms) => sleep(ms, signal),
      press: async (spec, holdMs = 700) => {
        if (signal.aborted) return;
        const parsed = chord(spec);
        setKeys(parsed.caps);
        pressChord(parsed);
        await sleep(holdMs, signal);
        setKeys(null);
      },
      type: async (selector, text) => {
        const input = query(selector);
        if (!(input instanceof HTMLInputElement)) return;
        setKeys(null);
        await typeInto(input, text, { signal });
      },
      clickOn: async (selector) => {
        const target = queryVisible(selector);
        if (!target) return;
        setCursor(centerOf(target));
        // Let the cursor visibly travel before it lands.
        await sleep(700, signal);
        if (signal.aborted) return;
        clickElement(target);
        await sleep(400, signal);
      },
      submitDialog: async () => {
        // Checked here as well as in the caller: a visitor who interrupts
        // mid-quick-add must not have an event created after they took over.
        if (signal.aborted) return;
        const form = query("[data-slot='dialog-content'] form");
        if (!(form instanceof HTMLFormElement)) return;
        setKeys(["return"]);
        form.requestSubmit();
        await sleep(600, signal);
        setKeys(null);
      },
    };

    const runBeat = async (beat: DemoBeat) => {
      setCaption(beat.caption);
      await beat.run(context);
      if (signal.aborted) return;
      await sleep(beat.restMs ?? 900, signal);
    };

    const runFrom = async (index: number): Promise<void> => {
      if (signal.aborted) return;
      const beat = DEMO_SCRIPT[index % DEMO_SCRIPT.length];
      if (!beat) return;
      await runBeat(beat);
      if (signal.aborted) return;
      return runFrom(index + 1);
    };

    // Late enough that the grid has laid out and the first paint has settled.
    const start = window.setTimeout(() => {
      focusGrid();
      void runFrom(0);
    }, 1100);

    return () => {
      window.clearTimeout(start);
      controller.abort();
      setKeys(null);
      setCursor(null);
    };
  }, [onScreen, rootRef, runId, status]);

  return useMemo(
    () => ({ status, caption, keys, cursor, replay }),
    [caption, cursor, keys, replay, status],
  );
}
