import { Link } from "@tanstack/react-router";

const GITHUB_URL = "https://github.com/krmznkr/julian";

function todayRoute() {
  const today = new Date();
  return {
    year: String(today.getFullYear()),
    month: today.getMonth() + 1,
    day: today.getDate(),
  };
}

const FEATURES = [
  {
    title: "The whole year",
    body: "All twelve months on a single screen, built around all-day and multi-day events instead of hourly slots.",
  },
  {
    title: "Google Calendar",
    body: "Optional sign-in pulls your calendars and tasks. Without it, Julian runs entirely on local sample data.",
  },
  {
    title: "Desktop app",
    body: "A thin Tauri shell wraps the same build into a native macOS app, with PKCE sign-in and no embedded secrets.",
  },
];

export function LandingPage() {
  const today = todayRoute();

  return (
    <main className="relative flex min-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] bg-[size:64px_64px] opacity-20 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
      />

      <header className="relative z-10 mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
        <span className="text-[15px] font-semibold tracking-tight">Julian</span>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-border px-4 py-1.5 text-sm text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
        >
          GitHub
        </a>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-6 py-20 text-center">
        <p className="mb-6 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          Open source · MIT
        </p>
        <h1 className="max-w-3xl text-balance text-5xl font-semibold tracking-tighter md:text-7xl">
          Your year,{" "}
          <span className="bg-gradient-to-b from-foreground to-foreground/50 bg-clip-text text-transparent">
            on one page.
          </span>
        </h1>
        <p className="mt-6 max-w-xl text-balance text-base text-muted-foreground md:text-lg">
          Julian is a calm, browser-based full-year calendar for the events that actually shape a
          year — trips, deadlines, seasons — not half-hour meetings.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/year/$year"
            params={{ year: today.year }}
            search={{ month: today.month, day: today.day }}
            className="inline-flex h-11 items-center rounded-full bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-85"
          >
            Open the calendar
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center rounded-full border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            View source
          </a>
        </div>
      </section>

      <section className="relative z-10 mx-auto w-full max-w-5xl px-6 pb-16">
        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-border bg-card p-6 text-left"
            >
              <h2 className="text-sm font-medium">{feature.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-border">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-6 text-xs text-muted-foreground">
          <span>MIT licensed</span>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            github.com/krmznkr/julian
          </a>
        </div>
      </footer>
    </main>
  );
}
