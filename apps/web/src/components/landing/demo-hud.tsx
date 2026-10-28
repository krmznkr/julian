import { cn } from "@/lib/utils";
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
      className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-3 pt-0.5 pb-1 text-xs md:py-2"
    >
      {/* On phones the idle hint is left to screen readers so the controls fit
          on one row; a tour's captions stay visible. */}
      <p
        aria-live="polite"
        className={cn("min-w-0 text-muted-foreground", !playing && "max-md:sr-only")}
      >
        {playing ? (
          <>
            <span className="mr-2 font-medium text-foreground">Tour {step + 1}/3</span>
            {caption}
          </>
        ) : (
          "Your turn. Click a day to explore, or add a sample event."
        )}
      </p>
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 md:shrink-0 md:gap-2">
        <button
          type="button"
          onClick={playing ? takeControl : replay}
          className="inline-flex h-8 items-center rounded-md border border-border bg-background px-2.5 font-medium hover:bg-accent md:h-auto md:py-1.5"
        >
          {playing ? "Try it now" : "Watch 15s tour"}
        </button>
        <button
          type="button"
          onClick={addEvent}
          className="inline-flex h-8 items-center rounded-md bg-foreground px-2.5 font-medium text-background md:h-auto md:py-1.5"
        >
          Add sample event
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-8 items-center rounded-md px-2 underline underline-offset-2 md:h-auto md:py-1.5"
        >
          Reset demo
        </button>
      </div>
    </div>
  );
}
