// Runs a component's effects as fibers it owns.
//
// Starting a new effect interrupts the one still running, and unmounting
// interrupts whatever is left. Effects do their own dispatching, so an
// interrupted fiber never resumes to deliver a stale result, and interruption
// reaches in-flight requests through the HTTP client's `AbortSignal`.
import { Effect, type Fiber } from "effect";
import { useCallback, useEffect, useMemo, useRef } from "react";

export function useLatestFiber() {
  const current = useRef<Fiber.Fiber<void, never> | null>(null);

  const interrupt = useCallback(() => {
    const fiber = current.current;
    current.current = null;
    // Synchronous on purpose: React calls this from cleanup and event handlers,
    // and the superseded fiber must be stopped before anything else can settle.
    fiber?.interruptUnsafe();
  }, []);

  const run = useCallback(
    (effect: Effect.Effect<void>) => {
      interrupt();
      current.current = Effect.runFork(effect);
    },
    [interrupt],
  );

  useEffect(() => interrupt, [interrupt]);

  return useMemo(() => ({ run, interrupt }), [run, interrupt]);
}
