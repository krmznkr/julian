import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { startGoogleAuth } from "@/lib/google-calendar";

// `/{yyyy}` without a Google session: offer sign-in or the demo instead of an
// empty grid.
export function SignedOutScreen({ year }: { year: number }) {
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
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-xl rounded-3xl border border-border/70 bg-card p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {year}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          Connect a calendar to see {year}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          Julian reads your Google Calendar in this browser. Connect it, or look around the demo on
          sample data first.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button onClick={connectGoogle} disabled={connecting}>
            {connecting ? "Connecting…" : "Connect Google Calendar"}
          </Button>
          <Button asChild variant="outline">
            <a href={`/demo/${year}`}>Open the demo</a>
          </Button>
        </div>
        {error === null ? null : (
          <p role="alert" className="mt-4 text-sm text-destructive">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
