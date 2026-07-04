import { Button } from "@/components/ui/button";
import { Link } from "@/lib/router";

export function NotFoundScreen() {
  const currentYear = new Date().getFullYear();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-10 text-foreground">
      <section className="w-full max-w-xl rounded-3xl border border-border/70 bg-card p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Page not found
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">
          This page has already drifted out of view
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          The link may be outdated, or the page may have moved during the app migration. You can
          head home, jump straight back into your calendar, or return to the previous page.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild>
            <Link href={`/year/${currentYear}`}>Open current year</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
          <Button variant="ghost" onClick={() => window.history.back()}>
            Go back
          </Button>
        </div>
      </section>
    </main>
  );
}
