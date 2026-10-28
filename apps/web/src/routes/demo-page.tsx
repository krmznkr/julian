import { useCallback, useState } from "react";
import { DemoYearView } from "@/components/landing/demo-year-view";
import { useRoutePort } from "@/components/year-view/use-route-port";
import { startGoogleAuth } from "@/lib/google-calendar";

// `/demo/{yyyy}`: the real year view on sample data, linked from the marketing site.
export function DemoPage({ year }: { year: number }) {
  const router = useRoutePort("/demo/$year");
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
      year={year}
      router={router}
      banner={
        // Below md (phones) the banner is one row: a short notice that wraps
        // to two lines beside Connect. From md up it keeps the centred layout.
        <div className="flex flex-wrap items-center gap-2 bg-muted/40 px-3 py-1 text-xs md:justify-center md:gap-x-3 md:gap-y-1 md:border-b md:border-border/40 md:px-6 md:py-2 md:text-center md:text-sm">
          <p className="min-w-40 flex-1 text-[11px] leading-[14px] text-muted-foreground md:contents md:text-sm md:leading-5">
            <span className="font-semibold text-foreground md:rounded md:border md:border-border md:bg-background md:px-2 md:py-0.5 md:text-xs md:uppercase md:tracking-wide">
              Demo · Sample data
            </span>
            <span className="md:hidden">. Changes stay here. </span>
            <span className="hidden md:inline">Try it here. Changes stay in this demo.</span>
            <a href="/home" className="text-foreground underline underline-offset-2 md:text-xs">
              About Julian
            </a>
          </p>
          <button
            type="button"
            onClick={connectGoogle}
            disabled={connecting}
            className="inline-flex h-8 shrink-0 items-center rounded-full bg-foreground px-3 text-xs font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-60 md:h-7 md:px-3.5"
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
