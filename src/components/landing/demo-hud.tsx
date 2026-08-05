// The screen-recording furniture: a caption strip, Mac keycaps for whatever the
// tour just pressed, and a pointer you can follow.
import { cn } from "@/lib/utils";
import type { DemoPlayerState } from "@/components/landing/use-demo-player";

function Keycap({ label }: { label: string }) {
  const wide = label.length > 1;
  return (
    <kbd
      className={cn(
        "inline-flex h-9 items-center justify-center rounded-[7px] border border-white/15 bg-white/10 font-sans text-[13px] font-medium text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.35),0_1px_2px_rgba(0,0,0,0.4)]",
        wide ? "px-3" : "w-9",
      )}
    >
      {label}
    </kbd>
  );
}

export function DemoHud({ caption, keys, status, replay }: DemoPlayerState) {
  // Nothing to narrate on touch: the visitor is already the one driving.
  if (status === "static") return null;

  const idle = status !== "playing";
  const idleCopy =
    status === "reduced-motion"
      ? "Motion is off, so the tour is paused. It's a real calendar — try it."
      : "You're driving now — it's a real calendar, nothing saves.";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-3 px-4 pb-6 print:hidden">
      <div
        className={cn(
          "flex items-center gap-1.5 transition-all duration-200",
          keys && keys.length > 0 ? "opacity-100" : "translate-y-1 opacity-0",
        )}
        aria-hidden
      >
        {(keys ?? []).map((label, index) => (
          <Keycap key={`${label}-${index}`} label={label} />
        ))}
      </div>

      {idle ? (
        <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 rounded-full bg-neutral-900/90 px-4 py-2 text-center text-[13px] text-white/80 backdrop-blur">
          <span>{idleCopy}</span>
          <button
            type="button"
            onClick={replay}
            className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-white/25"
          >
            {status === "reduced-motion" ? "Play the tour" : "Replay the tour"}
          </button>
        </div>
      ) : (
        <p
          className={cn(
            "max-w-xl rounded-full bg-neutral-900/90 px-5 py-2.5 text-center text-[13px] leading-snug text-white/90 backdrop-blur transition-all duration-300",
            caption ? "opacity-100" : "translate-y-1 opacity-0",
          )}
        >
          {caption ?? "\u00a0"}
        </p>
      )}
    </div>
  );
}

export function GhostCursor({ cursor }: { cursor: DemoPlayerState["cursor"] }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed left-0 top-0 z-[70] transition-[transform,opacity] duration-[650ms] ease-out print:hidden",
        cursor ? "opacity-100" : "opacity-0",
      )}
      style={{ transform: `translate3d(${cursor?.x ?? 0}px, ${cursor?.y ?? 0}px, 0)` }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 20 20"
        className="drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]"
      >
        <path
          d="M3 1.5 16.5 9.2l-5.9 1.1-2.7 5.6z"
          fill="white"
          stroke="rgba(0,0,0,0.65)"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
