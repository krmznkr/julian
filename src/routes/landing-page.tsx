import { useCallback, useState } from "react";
import { DemoYearView } from "@/components/landing/demo-year-view";
import { startGoogleAuth } from "@/lib/google-calendar";

export function LandingPage() {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectGoogle = useCallback(async () => {
    setConnecting(true);
    setError(null);
    try {
      await startGoogleAuth();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect to Google.");
      setConnecting(false);
    }
  }, []);

  return (
    <DemoYearView
      banner={
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border/40 bg-muted/40 px-3 py-2 text-center text-sm sm:px-6">
          <span className="rounded border border-border bg-background px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
            Demo · Sample data
          </span>
          <span className="text-muted-foreground">Try it here. Changes stay in this demo.</span>
          <button
            type="button"
            onClick={connectGoogle}
            disabled={connecting}
            className="inline-flex h-7 items-center rounded-full bg-foreground px-3.5 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
          >
            {connecting ? "Connecting…" : "Connect my Google Calendar"}
          </button>
          {error ? (
            <span role="alert" className="w-full text-xs text-destructive">
              {error}
            </span>
          ) : null}
        </div>
      }
    />
  );
}
