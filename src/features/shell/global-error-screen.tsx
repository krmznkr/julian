import { Link } from "@/lib/router";

export function GlobalErrorScreen({
  error,
  onRetry,
  eyebrow = "Something went wrong",
  title = "We hit an unexpected error",
  description = "Please try again. If this keeps happening, refresh the page.",
  homeLabel = "Go home",
}: {
  error?: Error | null;
  onRetry?: () => void;
  eyebrow?: string;
  title?: string;
  description?: string;
  homeLabel?: string;
}) {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center px-6 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-card-foreground">{title}</h1>
        <p className="mt-4 text-sm text-muted-foreground">{description}</p>
        {error?.message ? (
          <p className="mt-3 rounded-xl border border-border/70 bg-muted/35 px-4 py-3 text-left text-xs text-muted-foreground">
            {error.message}
          </p>
        ) : null}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          {onRetry ? (
            <button
              className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
              onClick={onRetry}
              type="button"
            >
              Try again
            </button>
          ) : null}
          <Link
            className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-border bg-background px-4 py-2 text-sm font-medium transition hover:bg-accent hover:text-accent-foreground"
            href="/"
          >
            {homeLabel}
          </Link>
        </div>
      </section>
    </main>
  );
}
