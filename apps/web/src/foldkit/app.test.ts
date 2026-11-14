import { describe, expect, it } from "vitest";
import { Option } from "effect";
import { fromString } from "foldkit/url";
import { UrlRequest } from "foldkit/navigation";
import { buildDemoYear } from "@/demo/demo-data";
import { init, update } from "./app";
import { Message, eventKey, initialModel, type Model } from "./model";

const demo = buildDemoYear(2026, new Date(2026, 2, 10));
const seed: Model = {
  ...initialModel("/demo/2026?month=3&day=10"),
  ...demo,
  page: "demo",
  year: 2026,
  today: "2026-03-10",
  date: "2026-03-10",
  yearInput: "2026",
  loading: false,
  hydrated: true,
  loadId: 1,
  selectedCalendarIds: demo.calendars.map((calendar) => calendar.id),
};
const action = (model: Model, name: Parameters<typeof Message.ClickedAction>[0]["action"]) =>
  update(model, Message.ClickedAction({ action: name }));
const key = (
  model: Model,
  value: string,
  extras: Partial<Parameters<typeof Message.PressedKey>[0]> = {},
) =>
  update(
    model,
    Message.PressedKey({
      key: value,
      code: value,
      shift: false,
      alt: false,
      mod: false,
      area: "grid",
      ...extras,
    }),
  );
const url = (value: string) => Option.getOrThrow(fromString(`https://julian.invalid${value}`));

describe("Foldkit application lifecycle", () => {
  it("focuses the skip-link target and ignores unchanged scroll windows", () => {
    expect(
      update(
        seed,
        Message.ClickedLink({ request: UrlRequest.Internal({ url: url("/demo#main-content") }) }),
      ).commands?.[0]?.args,
    ).toEqual({ selector: "#main-content" });
    expect(
      update(seed, Message.ScrolledGrid({ first: seed.firstMonth, last: seed.lastMonth })).model,
    ).toBe(seed);
  });
  it("keeps marketing navigation separate from calendar history and reports auth failures", () => {
    const home = update(
      seed,
      Message.ClickedLink({ request: UrlRequest.Internal({ url: url("/home") }) }),
    );
    expect(home.commands?.[0]?.args).toMatchObject({ external: true });
    expect(
      update(
        seed,
        Message.ClickedLink({ request: UrlRequest.Internal({ url: url("/demo/2027") }) }),
      ).commands?.[0]?.args,
    ).toMatchObject({ external: false });
    expect(
      update(
        seed,
        Message.ClickedLink({
          request: UrlRequest.External({ href: "https://calendar.google.com/" }),
        }),
      ).commands?.[0]?.args,
    ).toMatchObject({ external: true });
    const failed = update(
      { ...seed, connecting: true },
      Message.FailedAuth({ error: "Denied" }),
    ).model;
    expect(failed).toMatchObject({ connecting: false, error: "Denied" });
    expect(action(failed, "dismiss-error").model.error).toBeNull();
    expect(action(seed, "connect").model.connecting).toBe(true);
    expect(action(seed, "logout").commands?.[0]?.name).toBe("Auth");
    expect(update(seed, Message.LoggedOut()).model.page).toBe("signed-out");
    expect(
      update({ ...seed, page: "callback" }, Message.SucceededAuth()).commands?.[0]?.args,
    ).toMatchObject({ external: true });
    expect(update(seed, Message.SucceededAuth()).model).toBe(seed);
    expect(update(seed, Message.ChangedSystemTheme({ dark: true })).commands).toHaveLength(1);
    expect(
      update({ ...seed, theme: "light" }, Message.ChangedSystemTheme({ dark: true })).commands,
    ).toBeUndefined();
  });

  it("shows signed-out and invalid routes without loading calendar data", () => {
    const signedOut = update(
      { ...seed, page: "signed-out" },
      Message.ChangedUrl({ url: url("/2026/07") }),
    );
    expect(signedOut.model).toMatchObject({ page: "signed-out", date: "2026-07-01" });
    expect(signedOut.commands?.[0]?.args).toMatchObject({
      href: "/2026?month=7&day=1&details=false",
    });
    expect(update(seed, Message.ChangedUrl({ url: url("/invalid") })).model.page).toBe("not-found");
  });

  it("runs the tour through real transitions and stops on user input", () => {
    const started = action(seed, "tour").model;
    const first = update(started, Message.AdvancedTour({ step: 1 })).model;
    expect(first).toMatchObject({ tour: 1, details: true });
    const second = update(first, Message.AdvancedTour({ step: 2 })).model;
    expect(second).toMatchObject({ tour: 2, dialog: "create", titleInput: "Dinner with friends" });
    expect(update(second, Message.AdvancedTour({ step: 20 })).commands?.[0]?.name).toBe(
      "MutateEvent",
    );
    const third = update(second, Message.AdvancedTour({ step: 3 })).model;
    expect(third.dialog).toBe("commands");
    expect(update(third, Message.AdvancedTour({ step: 4 })).model).toMatchObject({
      tourRunning: false,
      dialog: "none",
    });
    expect(action(first, "tour").model.tourRunning).toBe(false);
    expect(key(first, "ArrowDown").model.tourRunning).toBe(false);
    expect(update(seed, Message.AdvancedTour({ step: 1 })).model).toBe(seed);
    expect(action(seed, "reset-demo").commands?.[0]?.args).toMatchObject({ reset: true });
  });
  it("boots routing without keeping an OAuth code in the model", () => {
    expect(init(url("/auth/callback?code=private-value")).model.href).toBe("/auth/callback");
    expect(
      update(seed, Message.ChangedUrl({ url: url("/auth/callback?code=private-value") })).model
        .href,
    ).toBe("/auth/callback");
    const boot = update(
      initialModel("/demo"),
      Message.Booted({
        today: "2026-03-10",
        connected: false,
        width: 1200,
        theme: "system",
        sidebarCollapsed: false,
        fontSize: "medium",
        density: "comfortable",
        platform: "Linux",
        reducedMotion: true,
      }),
    );
    expect(boot.model).toMatchObject({
      page: "demo",
      date: "2026-03-10",
      loading: true,
      loadId: 1,
    });
    expect(boot.commands?.some((command) => command.name === "LoadYear")).toBe(true);
    const callback = update(
      initialModel("/auth/callback"),
      Message.Booted({
        today: "2026-03-10",
        connected: false,
        width: 1200,
        theme: "light",
        sidebarCollapsed: false,
        fontSize: "medium",
        density: "compact",
        platform: "MacIntel",
        reducedMotion: false,
      }),
    );
    expect(callback.commands?.some((command) => command.name === "Auth")).toBe(true);
  });
  it("ignores stale loads and exposes partial-source failures", () => {
    const loading = action(seed, "refresh").model;
    const loaded = Message.SucceededLoad({
      id: loading.loadId,
      year: 2026,
      ...demo,
      selectedCalendarIds: seed.selectedCalendarIds,
      failures: [{ source: "Tasks", message: "Offline" }],
    });
    expect(update(seed, loaded).model).toBe(seed);
    const success = update(loading, loaded).model;
    expect(success.failures).toHaveLength(1);
    expect(success.status).toContain("Some calendars");
    expect(
      update(loading, Message.FailedLoad({ id: loading.loadId, year: 2025, error: "Late" })).model,
    ).toBe(loading);
    expect(
      update(loading, Message.FailedLoad({ id: loading.loadId, year: 2026, error: "Offline" }))
        .model.error,
    ).toBe("Offline");
  });
  it("follows copied URLs and browser back/forward", () => {
    const changed = update(
      seed,
      Message.ChangedUrl({ url: url("/demo/2027/02?day=28&details=true&view=timeline") }),
    ).model;
    expect(changed).toMatchObject({
      year: 2027,
      date: "2027-02-28",
      mode: "timeline",
      details: true,
      loading: true,
    });
    expect(
      update(changed, Message.ChangedUrl({ url: url("/demo/2026?month=3&day=10") })).model.date,
    ).toBe("2026-03-10");
  });
  it("persists calendar selection without discarding data", () => {
    const hidden = update(seed, Message.ClickedCalendar({ id: "demo-work" }));
    expect(hidden.model.selectedCalendarIds).not.toContain("demo-work");
    expect(hidden.model.events).toBe(seed.events);
    expect(hidden.commands?.[0]?.name).toBe("PersistSelection");
    expect(
      update(hidden.model, Message.ClickedCalendar({ id: "demo-work" })).model.selectedCalendarIds,
    ).toContain("demo-work");
  });
});

describe("keyboard and dialog behavior", () => {
  it.each([
    ["ArrowDown", "2026-03-11"],
    ["ArrowUp", "2026-03-09"],
    ["ArrowLeft", "2026-02-10"],
    ["ArrowRight", "2026-04-10"],
    ["Home", "2026-03-01"],
    ["End", "2026-03-31"],
    ["PageDown", "2026-03-17"],
    ["PageUp", "2026-03-03"],
  ])("moves focus with %s", (value, date) => expect(key(seed, value).model.date).toBe(date));
  it("supports modifier navigation and day/month typeahead", () => {
    expect(key(seed, "ArrowDown", { shift: true }).model.date).toBe("2026-03-17");
    expect(key(seed, "ArrowRight", { alt: true }).model.year).toBe(2027);
    const first = key(seed, "2").model;
    expect(key(first, "5").model.date).toBe("2026-03-25");
    expect(key(seed, "&", { shift: true, code: "Digit7" }).model.date).toBe("2026-07-10");
    const waiting = key(seed, "1").model;
    expect(update(waiting, Message.ElapsedDigits({ id: waiting.digitId - 1 })).model).toBe(waiting);
    expect(update(waiting, Message.ElapsedDigits({ id: waiting.digitId })).model.date).toBe(
      "2026-03-01",
    );
  });
  it("opens details and keeps typing out of global shortcuts", () => {
    const opened = key(seed, "Enter").model;
    expect(opened.details).toBe(true);
    expect(opened.selectedKey).not.toBeNull();
    expect(key(opened, "Escape").model.details).toBe(false);
    expect(key(seed, "n", { area: "input" }).model.dialog).toBe("none");
    expect(key(seed, "n").model.dialog).toBe("create");
    expect(key(seed, "?", { shift: true }).model.dialog).toBe("help");
    expect(key(seed, "k", { mod: true }).model.dialog).toBe("commands");
    expect(key({ ...seed, query: "trip" }, "Escape", { area: "search" }).model.query).toBe("");
  });
  it("releases the modal drawer before focusing search or Commands", () => {
    const drawer = action({ ...seed, width: 390 }, "calendars").model;
    expect(drawer.dialog).toBe("calendars");
    expect(key(drawer, "/").model.dialog).toBe("none");
    expect(key(drawer, "k", { mod: true }).model.dialog).toBe("commands");
    expect(update(drawer, Message.ChangedViewport({ width: 1000 })).model.dialog).toBe("none");
  });
  it("opens editing only for writable events", () => {
    const readonly = seed.events.find((event) => event.calendarId === "__google_tasks__")!;
    const selected = { ...seed, selectedKey: eventKey(readonly) };
    expect(action(selected, "edit").model.dialog).toBe("none");
    expect(action(selected, "move").model.dialog).toBe("none");
    expect(action(selected, "delete").model.dialog).toBe("none");
  });
});

describe("writes and optimistic moves", () => {
  const event = seed.events.find((item) => item.title === "Deep work sprint")!;
  const selected: Model = { ...seed, selectedKey: eventKey(event), details: true };
  it("creates, edits and deletes through commands, retaining failures for retry", () => {
    const create = action(seed, "create").model;
    expect(action(create, "submit").model.dialogError).toContain("title");
    const typing = update(
      create,
      Message.ChangedField({ field: "titleInput", value: "Dinner" }),
    ).model;
    const submitting = action(typing, "submit");
    expect(submitting.model.busy).toBe(true);
    expect(submitting.commands?.[0]?.name).toBe("MutateEvent");
    expect(action(submitting.model, "close-dialog").model).toEqual(submitting.model);
    const failed = update(
      submitting.model,
      Message.FailedMutation({ year: 2026, error: "Offline" }),
    ).model;
    expect(failed).toMatchObject({ busy: false, dialogError: "Offline", titleInput: "Dinner" });
    const created = update(
      failed,
      Message.SucceededMutation({
        year: 2026,
        operation: "create",
        event: { ...event, id: "new", title: "Dinner" },
        key: null,
        title: "Dinner",
      }),
    ).model;
    expect(created.events.some((item) => item.id === "new")).toBe(true);
    const edited = update(
      created,
      Message.SucceededMutation({
        year: 2026,
        operation: "edit",
        event,
        key: null,
        title: "Renamed",
      }),
    ).model;
    expect(edited.events.find((item) => eventKey(item) === eventKey(event))?.title).toBe("Renamed");
    const deleted = update(
      edited,
      Message.SucceededMutation({ year: 2026, operation: "delete", event, key: null, title: "" }),
    ).model;
    expect(deleted.events.some((item) => eventKey(item) === eventKey(event))).toBe(false);
  });
  it("updates immediately, protects pending writes during reload, and rolls back only its event", () => {
    const opened = action(selected, "move").model;
    const moving = action({ ...opened, moveDate: "2026-11-10" }, "submit").model;
    expect(moving.events.find((item) => eventKey(item) === eventKey(event))?.start).toBe(
      "2026-11-10",
    );
    expect(moving.pending).toHaveLength(1);
    expect(
      action({ ...moving, dialog: "move", moveDate: "2026-11-15" }, "submit").model.pending,
    ).toHaveLength(1);
    const reload = update(
      moving,
      Message.SucceededLoad({
        id: moving.loadId,
        year: 2026,
        ...demo,
        selectedCalendarIds: moving.selectedCalendarIds,
        failures: [],
      }),
    ).model;
    expect(reload.events.find((item) => eventKey(item) === eventKey(event))?.start).toBe(
      "2026-11-10",
    );
    const failed = update(reload, Message.FailedMove({ id: 0, error: "Offline" })).model;
    expect(failed.events.find((item) => eventKey(item) === eventKey(event))?.start).toBe(
      event.start,
    );
    expect(failed.error).toContain("Original dates restored");
    expect(failed.pending).toEqual([]);
  });
  it("does not apply an old year's write result to a new year", () => {
    const moving = action(
      { ...action(selected, "move").model, moveDate: "2026-11-10" },
      "submit",
    ).model;
    const next = action(moving, "next-year").model;
    expect(update(next, Message.FailedMove({ id: 0, error: "Late" })).model.events).toEqual(
      next.events,
    );
    expect(
      update(
        next,
        Message.SucceededMutation({
          year: 2026,
          operation: "create",
          event,
          key: null,
          title: "Old",
        }),
      ).model,
    ).toBe(next);
  });
});
