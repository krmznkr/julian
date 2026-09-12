import { DemoYearView } from "@/components/landing/demo-year-view";
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
    body: "See all twelve months, with all-day events, multi-day trips, and timed appointments.",
  },
  {
    title: "Keyboard first",
    body: "Use arrow keys to move between days, N to add an event, and ⌘K or Ctrl+K to open commands.",
  },
  {
    title: "Your Google Calendar",
    body: "Connect Google Calendar and Tasks. View your events and due tasks, and create, rename, or delete calendar events.",
  },
  {
    title: "Yours to run",
    body: "MIT licensed. Deploy the browser app and an OAuth Worker with your own Google client credentials.",
  },
];

export function LandingPage() {
  const today = todayRoute();

  return (
    <div className="bg-background text-foreground">
      <div className="relative">
        <DemoYearView
          banner={
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border/40 bg-muted/40 px-6 py-2 text-center text-sm">
              <span className="font-medium tracking-tight">Your year, on one page.</span>
              <span className="hidden text-muted-foreground md:inline">
                Try the calendar with sample data.
              </span>
              <Link
                to="/year/$year"
                params={{ year: today.year }}
                search={{ month: today.month, day: today.day }}
                className="inline-flex h-7 items-center rounded-full bg-foreground px-3.5 text-xs font-medium text-background transition-opacity hover:opacity-85"
              >
                Use my calendar
              </Link>
            </div>
          }
        />
      </div>

      <section className="mx-auto w-full max-w-5xl px-6 py-20">
        <h2 className="max-w-2xl text-balance text-3xl font-semibold tracking-tighter md:text-4xl">
          A year view for Google Calendar
        </h2>
        <p className="mt-4 max-w-xl text-balance text-base text-muted-foreground">
          Connect your account to see your calendars and due tasks in this view.
        </p>

        <div className="mt-12 grid gap-4 md:grid-cols-2">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="rounded-xl border border-border bg-card p-6">
              <h3 className="text-sm font-medium">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-3">
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

      <footer className="border-t border-border">
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
    </div>
  );
}
