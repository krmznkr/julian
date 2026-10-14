import type { DemoPlayerState } from "./use-demo-player";

export function DemoHud({
  status,
  caption,
  step,
  replay,
  takeControl,
  addEvent,
  onReset,
}: DemoPlayerState & { onReset: () => void }) {
  const playing = status === "playing";
  return (
    <div
      data-demo-controls
      className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs"
    >
      <p aria-live="polite" className="min-w-0 text-muted-foreground">
        {playing ? (
          <>
            <span className="mr-2 font-medium text-foreground">Tour {step + 1}/3</span>
            {caption}
          </>
        ) : (
          "Your turn. Click a day to explore, or add a sample event."
        )}
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={playing ? takeControl : replay}
          className="rounded-md border border-border bg-background px-2.5 py-1.5 font-medium hover:bg-accent"
        >
          {playing ? "Try it now" : "Watch 15s tour"}
        </button>
        <button
          type="button"
          onClick={addEvent}
          className="rounded-md bg-foreground px-2.5 py-1.5 font-medium text-background"
        >
          Add sample event
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md px-2 py-1.5 underline underline-offset-2"
        >
          Reset demo
        </button>
      </div>
    </div>
  );
}
