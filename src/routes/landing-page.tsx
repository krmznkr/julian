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
    body: "All twelve months on one screen, built around the things that actually shape a year — trips, deadlines, seasons — instead of half-hour slots.",
  },
  {
    title: "Keyboard first",
    body: "Everything above happened without a mouse. Arrows move, N adds, ⌘K finds the rest. Your hands never leave the keys.",
  },
  {
    title: "Your Google Calendar",
    body: "Sign in and the same view fills with your real calendars and tasks — read them, and add or edit events in place.",
  },
  {
    title: "Yours to run",
    body: "MIT licensed and backend-free: a static bundle plus a tiny Worker, with no client secret ever shipped to the browser.",
  },
];

export function LandingPage() {
  const today = todayRoute();

  return (
    <div className="bg-background text-foreground">
      {/* The demo is the hero. It is the real app, playing itself. */}
      <div className="relative">
        <DemoYearView
          banner={
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-border/40 bg-muted/40 px-6 py-2 text-center text-sm">
              <span className="font-medium tracking-tight">Your year, on one page.</span>
              <span className="hidden text-muted-foreground md:inline">
                You're looking at the real app on sample data — take the keyboard whenever you like.
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
          Nothing above this line was a screenshot.
        </h2>
        <p className="mt-4 max-w-xl text-balance text-base text-muted-foreground">
          The calendar you just watched is the signed-in app, running on sample data. Connect Google
          Calendar and the same screen fills with your own year.
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
