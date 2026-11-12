import { describe, test } from "vitest";
import { expect, given, role, scene, selector, text } from "foldkit/scene";
import { buildDemoYear } from "@/components/landing/demo-data";
import { update } from "./app";
import { initialModel, type Model } from "./model";
import { view } from "./view";

const demo = buildDemoYear(2026, new Date(2026, 2, 10));
const seed: Model = {
  ...initialModel("/2026"),
  ...demo,
  page: "calendar",
  year: 2026,
  today: "2026-03-10",
  date: "2026-03-10",
  yearInput: "2026",
  loading: false,
  hydrated: true,
  selectedCalendarIds: demo.calendars.map((calendar) => calendar.id),
};
const app = { update, view };

describe("view", () => {
  test("a connected calendar offers Disconnect and reports sync failures", () => {
    scene(
      app,
      given({
        ...seed,
        failures: [{ source: "Work", message: "Forbidden" }],
        error: "Could not reach Google.",
      }),
      expect(role("button", { name: "Disconnect Google Calendar" })).toExist(),
      expect(text("Work: Forbidden")).toExist(),
      expect(text("Could not load Work")).toExist(),
      expect(role("alert")).toHaveText(/Could not reach Google/),
      expect(role("button", { name: "Dismiss" })).toExist(),
    );
  });

  test("loading states show the calendar skeleton and the refresh notice", () => {
    scene(
      app,
      given({ ...seed, calendars: [], events: [], loading: true, hydrated: false }),
      expect(text("Loading calendars...")).toExist(),
      expect(text("Loading calendar...")).toExist(),
    );
    scene(
      app,
      given({ ...seed, loading: true }),
      expect(text("Loading events...")).toExist(),
      expect(text("Loading")).toExist(),
    );
    scene(
      app,
      given({ ...seed, calendars: [], selectedCalendarIds: [], events: [] }),
      expect(text("Connect Google Calendar to see your calendars and events.")).toExist(),
    );
    scene(
      app,
      given({ ...seed, query: "nothing matches this" }),
      expect(text("No events found")).toExist(),
      expect(text("0 matching events")).toExist(),
    );
  });

  test("dialogs render like the shadcn dialogs they replace", () => {
    scene(
      app,
      given({ ...seed, dialog: "help" }),
      expect(role("heading", { name: "Keyboard shortcuts" })).toExist(),
    );
    scene(
      app,
      given({ ...seed, dialog: "settings" }),
      expect(selector("#font-size")).toExist(),
      expect(role("button", { name: "Switch to light theme" })).toExist(),
    );
    scene(
      app,
      given({ ...seed, dialog: "commands", commandQuery: "zzz" }),
      expect(text("No matching commands.")).toExist(),
    );
    scene(
      app,
      given({ ...seed, dialog: "move", moveDate: "2026-03-12", dialogError: "Nope" }),
      expect(role("button", { name: "Move" })).toBeEnabled(),
      expect(text("Nope")).toExist(),
    );
    scene(
      app,
      given({ ...seed, dialog: "create", calendars: [], busy: true }),
      expect(text("Connect a writable Google calendar to create events.")).toExist(),
      expect(role("button", { name: "Adding…" })).toExist(),
    );
    scene(
      app,
      given({ ...seed, dialog: "calendars" }),
      expect(selector("[data-mobile-sidebar]")).toExist(),
    );
  });

  test("timeline day details sit centered and show read-only events", () => {
    scene(
      app,
      given({ ...seed, mode: "timeline", details: true, date: "2026-03-11", calendars: [] }),
      expect(role("dialog", { name: "March 11 events" })).toExist(),
    );
  });

  test("route screens", () => {
    scene(
      app,
      given({ ...seed, page: "signed-out", error: "Popup blocked" }),
      expect(role("heading", { name: "Connect a calendar to see 2026" })).toExist(),
      expect(role("link", { name: "Open the demo" })).toExist(),
      expect(role("alert")).toHaveText("Popup blocked"),
    );
    scene(
      app,
      given({ ...seed, page: "not-found" }),
      expect(role("link", { name: "Go home" })).toExist(),
    );
    scene(
      app,
      given({ ...seed, page: "callback", error: "Denied" }),
      expect(role("heading", { name: "Authentication failed" })).toExist(),
    );
    scene(
      app,
      given({ ...seed, page: "callback" }),
      expect(role("heading", { name: "Authorizing with Google..." })).toExist(),
    );
    scene(
      app,
      given({ ...seed, page: "loading" }),
      expect(role("heading", { name: "Loading calendar..." })).toExist(),
    );
  });
});
